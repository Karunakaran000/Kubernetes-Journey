# CloudCart Lite — Kubernetes Troubleshooting Guide

## 1. Purpose

This guide documents practical Kubernetes troubleshooting scenarios encountered while deploying CloudCart Lite.

The goal is to develop a repeatable troubleshooting method:

1. Identify the failing component.
2. Gather evidence before changing resources.
3. Find the root cause.
4. Apply the smallest appropriate fix.
5. Verify recovery.
6. Understand how to prevent the same failure in production.

The examples cover application startup, Deployments, Services, DNS, Ingress, NetworkPolicies, persistent storage, configuration, and container security.

## 2. General Troubleshooting Workflow

```text
Application problem
        |
        v
Check Pod and workload status
        |
        v
Inspect Events and Pod details
        |
        v
Review application logs
        |
        v
Check Services and EndpointSlices
        |
        v
Check DNS and NetworkPolicies
        |
        v
Inspect configuration and dependencies
        |
        v
Check probes, resources, and storage
        |
        v
Fix the root cause
        |
        v
Verify recovery
```

Start with evidence rather than immediately deleting Pods or restarting Deployments.

### First-response commands

```bash
kubectl get pods -n cloudcart -o wide
kubectl get deployments -n cloudcart
kubectl get services -n cloudcart
kubectl get events -n cloudcart \
  --sort-by=.metadata.creationTimestamp
```

For an individual Pod:

```bash
kubectl describe pod <pod-name> -n cloudcart
kubectl logs <pod-name> -n cloudcart
kubectl logs <pod-name> -n cloudcart --previous
```

`--previous` retrieves logs from the preceding container instance when one is available.

---

## 3. Frontend CrashLoopBackOff — Invalid Upstream Hostname

### Symptom

The frontend Pod entered a crash-loop state after the NGINX configuration referenced an upstream named `backend`.

### Root cause

The configuration used a hostname that did not correspond to the Kubernetes Service name.

The original configuration was based on a different environment where the application could resolve a service named `backend`. In Kubernetes, the actual backend Service was named `backend-service`.

NGINX failed to resolve the upstream hostname during startup.

### Why this happens

Container networking is environment-specific. A service name used in Docker Compose is not automatically a Kubernetes Service name.

Kubernetes provides DNS-based service discovery through Services and CoreDNS.

### Fix

The frontend NGINX configuration was changed to use:

```nginx
location /api/ {
    proxy_pass http://backend-service:8080;
}
```

The frontend image was rebuilt and published as version `1.4`.

### Verification

```bash
kubectl get pods -n cloudcart
kubectl logs deployment/cloudcart-frontend -n cloudcart
kubectl get services -n cloudcart
```

Confirm that the frontend Pods become ready and the backend Service exists.

### Production lesson

Use the correct Service DNS name, validate configuration before deployment, and test connectivity between workloads. A successful image build does not guarantee that runtime dependencies can be resolved.

---

## 4. Service Exists but Has No Endpoints

### Symptom

A Kubernetes Service existed, but requests through it failed.

### Root cause

The Service selector was deliberately changed to a label that did not match the intended Pods.

A Service selects Pods using labels. If no eligible Pods match its selector, it has no usable backend endpoints.

### Fix

Restore the correct selector:

```yaml
spec:
  selector:
    app: nginx-yaml
```

The label must match the actual Pod labels.

### Verification

```bash
kubectl get pods --show-labels -n default
kubectl get service nginx-service -n default
kubectl get endpointslices -n default
```

Check that the intended Pods match the Service selector and appear in the EndpointSlices.

### Production lesson

When a Service is unreachable, verify the complete path:

```text
Client
  |
  v
Service
  |
  v
Selector
  |
  v
Eligible Pod endpoints
  |
  v
Container port
```

Do not assume a Service is healthy merely because the Service object exists.

---

## 5. NetworkPolicy Blocks Application Traffic

### Symptom

A workload could not reach another workload even though both Pods were running.

### Root cause

CloudCart uses a default-deny NetworkPolicy model. Traffic that is not explicitly allowed can be blocked.

For a connection between isolated Pods, the source's egress policy and the destination's ingress policy must both permit the traffic.

DNS traffic must also be allowed when egress isolation would otherwise block it.

### Troubleshooting

Inspect the policies:

```bash
kubectl get networkpolicies -n cloudcart
kubectl describe networkpolicy -n cloudcart
```

Inspect Services and endpoints:

```bash
kubectl get services -n cloudcart
kubectl get endpointslices -n cloudcart
```

Verify:

* Source Pod labels.
* Destination Pod labels.
* Correct namespace selectors.
* Destination port.
* Source egress rules.
* Destination ingress rules.
* DNS permissions.
* Actual network-plugin enforcement.

### Important distinction

A successful DNS lookup proves name resolution worked. It does not prove that the application connection is permitted.

Similarly, a Service with endpoints does not prove that NetworkPolicies allow traffic to those endpoints.

### Production lesson

Use least-privilege network rules and test each required communication path. Keep a documented list of permitted flows between frontend, backend, database, and ingress components.

---

## 6. Network Troubleshooting — Incorrect Test Port

### Symptom

A test connection to the frontend on port `8080` failed.

### Root cause

The test targeted the wrong port. The frontend NGINX container listens on port `80`; port `8080` belongs to the backend application.

The failed test was not sufficient evidence that the NetworkPolicy was incorrect.

### Correct verification

Test the frontend on its listening port and the backend on its own listening port.

For example, the backend can be tested using:

```bash
kubectl port-forward -n cloudcart service/backend-service 8082:8080
```

In another terminal:

```bash
curl -i http://localhost:8082/actuator/health
```

### Production lesson

Before diagnosing networking, establish the intended protocol, destination port, Service port, target port, and container listening port.

A test using the wrong port can produce a misleading diagnosis.

---

## 7. Ingress Works Inside the Cluster but Not from the Host

### Symptom

The Ingress Controller accepted requests from inside the kind node, but direct access from the Windows host was not guaranteed.

### Root cause

The kind cluster runs Kubernetes nodes inside Docker containers. A NodePort inside the kind node is not automatically exposed on the host's network interface.

The Ingress resource and Controller can be working even when the host cannot reach the expected port.

### Troubleshooting

Inspect the Ingress and Controller:

```bash
kubectl get ingress -n cloudcart
kubectl get pods -n ingress-nginx
kubectl get services -n ingress-nginx
```

Check the actual port mappings and kind cluster configuration before assuming a route is externally reachable.

### Local browser solution

For straightforward local testing, forward a host port to the frontend Service:

```bash
kubectl port-forward -n cloudcart service/frontend-service 8080:80
```

Open:

`http://localhost:8080`

Keep the port-forward process running while using the application.

### Production lesson

Kubernetes routing configuration and external network reachability are separate concerns. Production exposure requires an appropriate load balancer, gateway, ingress configuration, and network path.

---

## 8. PostgreSQL Data Survives Pod Replacement

### Experiment

The PostgreSQL Pod was deleted and recreated to verify persistent storage behavior.

### Observation

Previously stored product records remained available after the Pod replacement.

### Why it worked

PostgreSQL stored its database files on a volume backed by a PersistentVolumeClaim rather than relying only on the container's writable filesystem.

```text
PostgreSQL
    |
    v
/var/lib/postgresql/data
    |
    v
PVC
    |
    v
PV
    |
    v
Storage provisioner
```

The recreated Pod mounted the persistent storage again.

### Verification

```bash
kubectl get pods -n cloudcart
kubectl get pvc -n cloudcart
kubectl get pv
```

The database can be queried using the PostgreSQL client inside the database Pod:

```bash
kubectl exec -n cloudcart postgres-0 -- \
  psql -U cloudcart -d cloudcart \
  -c "SELECT * FROM product;"
```

### Production lesson

Persistence protects against certain Pod lifecycle events; it does not guarantee high availability or protect against every storage failure.

Production databases need appropriate backups, recovery procedures, access controls, and tested restore operations.

**Warning:** Do not delete the PostgreSQL PVC merely to troubleshoot a Pod. PVC deletion can lead to data loss depending on the reclaim policy and provisioner.

---

## 9. ConfigMap Change Does Not Update Existing Environment Variables

### Symptom

The ConfigMap was changed from `LOG_LEVEL=INFO` to `LOG_LEVEL=Debug`, but an already-running container continued to report `LOG_LEVEL=INFO`.

### Root cause

Kubernetes supplies environment variables to the container when the container starts. Updating the source ConfigMap does not rewrite the environment of an existing process.

### Fix

Recreate or roll out the workload so that the container starts with the updated value.

For a standalone demonstration Pod:

```bash
kubectl delete pod configmap-env-demo -n cloudcart
kubectl apply -f cloudcart/k8s/security/configmap-env-demo.yaml
```

Then inspect the logs:

```bash
kubectl logs configmap-env-demo -n cloudcart
```

Use the actual file path in your repository.

### Production lesson

Prefer version-controlled configuration and a deliberate rollout strategy. Avoid relying on manual `kubectl edit` changes as the long-term source of truth.

Mounted ConfigMap files behave differently: they can update eventually, but the application must reread the file to apply the change.

---

## 10. SecurityContext — Non-Root Configuration Prevents Startup

### Symptom

The `securitycontext-demo` Pod entered `CreateContainerConfigError`.

The Pod's Events reported that the image would run as root while `runAsNonRoot` was enabled.

### Root cause

The BusyBox image defaults to root, UID `0`. Setting `runAsNonRoot: true` enforces a requirement; it does not automatically select a non-root UID.

Kubernetes correctly refused to start a container whose image configuration contradicted that requirement.

### Initial failure

```yaml
securityContext:
  runAsNonRoot: true
```

This alone did not ensure the image would run as a non-root user.

### Fix

For the demonstration, the Pod's security context was updated to specify UID and GID `1000`:

```yaml
securityContext:
  runAsUser: 1000
  runAsGroup: 1000
  runAsNonRoot: true
  seccompProfile:
    type: RuntimeDefault
```

The container security context also disabled privilege escalation and dropped all Linux capabilities.

Because these Pod security fields cannot be freely changed on an existing Pod, the old Pod was deleted and recreated.

### Verification

```bash
kubectl get pod securitycontext-demo -n cloudcart
kubectl logs securitycontext-demo -n cloudcart
kubectl exec securitycontext-demo -n cloudcart -- id
```

The observed identity was:

```text
uid=1000 gid=1000 groups=1000
```

This confirmed non-root execution in the lab.

### Production lesson

Use a base image that supports non-root execution, ensure filesystem permissions match the intended UID/GID, and enforce least privilege.

Do not assume UID `1000` is appropriate for every application image. Use the identity and permissions designed for the image.

---

## 11. RBAC — `describe` Is Not an RBAC Verb

### Symptom

The following command returned a warning and denied result:

```bash
kubectl auth can-i describe pods \
  --as=system:serviceaccount:cloudcart:cloudcart-backend \
  -n cloudcart
```

### Root cause

`describe` is a `kubectl` client command, not a Kubernetes RBAC verb.

Common RBAC verbs include:

* `get`
* `list`
* `watch`
* `create`
* `update`
* `patch`
* `delete`

The `kubectl describe` command makes API requests to retrieve information and then formats that information for display.

### Correct test

```bash
kubectl auth can-i get pods \
  --as=system:serviceaccount:cloudcart:cloudcart-backend \
  -n cloudcart
```

The lab identity was allowed to read Pods but denied permission to delete Pods and read Secrets.

### Production lesson

Test the actual API permissions a workload needs. Grant only the required verbs and resources instead of assigning broad permissions for convenience.

---

## 12. Pod Update Rejected — Immutable Fields

### Symptom

Applying an updated Pod manifest was rejected because the change modified `runAsUser` and `runAsGroup`.

The API error explained that only certain Pod fields can be changed after creation.

### Root cause

Many Pod specification fields are immutable after a Pod has been created. Changing a security identity is not an ordinary in-place update for an existing Pod.

### Fix

For the standalone demonstration Pod:

```bash
kubectl delete pod securitycontext-demo -n cloudcart
kubectl apply -f cloudcart/k8s/security/securitycontext-demo.yaml
```

Then verify that the replacement Pod starts with the intended settings.

For a Deployment-managed workload, update the Pod template in the Deployment. Kubernetes creates replacement Pods through a rollout.

### Production lesson

Understand whether a change affects a live resource or its Pod template. For managed workloads, update the declarative source and observe the rollout rather than manually editing individual Pods.

---

## 13. Database Table Name Error

### Symptom

A database query failed with:

```text
ERROR: relation "products" does not exist
```

### Root cause

The actual table was named `product`, not `products`.

The issue was the SQL table name, not a Kubernetes networking or storage failure.

### Investigation

Inspect the database's tables and confirm the current database and user:

```sql
\dt
SELECT current_database(), current_user;
```

Then query the actual table:

```sql
SELECT * FROM product;
```

### Production lesson

Separate application, database, storage, and networking failures. A failed SQL statement does not automatically indicate an infrastructure problem.

---

## 14. Resource and Health Troubleshooting

When a Pod is running slowly, restarting repeatedly, or becoming unavailable, inspect its resource configuration and probe events.

```bash
kubectl describe pod <pod-name> -n cloudcart
kubectl top pods -n cloudcart
kubectl get events -n cloudcart \
  --sort-by=.metadata.creationTimestamp
```

`kubectl top` requires a working Metrics API; it may not be available in every local cluster configuration.

### Interpret the evidence

| Symptom                      | Possible cause to investigate                                  |
| ---------------------------- | -------------------------------------------------------------- |
| `Pending`                    | Scheduling, resources, PVC binding, or constraints             |
| `ImagePullBackOff`           | Image name, tag, registry access, or credentials               |
| `CrashLoopBackOff`           | Application crash, bad configuration, or failed liveness probe |
| `CreateContainerConfigError` | Invalid container configuration or referenced resource         |
| `OOMKilled`                  | Container memory limit or memory pressure                      |
| Running but not Ready        | Readiness probe, dependency, or startup problem                |
| Service has no endpoints     | Selector mismatch or no eligible ready Pods                    |
| API timeout                  | NetworkPolicy, routing, application, or dependency issue       |

These are diagnostic starting points, not automatic root-cause conclusions. Confirm the cause using Events, logs, resource status, and connectivity tests.

---

## 15. Troubleshooting Checklist

Before declaring an incident resolved, confirm the following:

* [ ] The affected workload has the expected number of replicas.
* [ ] Pods are running and ready.
* [ ] Container logs no longer show the original failure.
* [ ] Services select the intended Pods.
* [ ] EndpointSlices contain eligible endpoints.
* [ ] DNS resolves the expected Service names.
* [ ] NetworkPolicies permit the required traffic.
* [ ] Configuration and Secret references are correct.
* [ ] Storage claims are bound and the expected data is present.
* [ ] Health endpoints and application requests succeed.
* [ ] The fix is reflected in the intended declarative configuration.
* [ ] No unrelated workloads were broken by the change.

## Conclusion

These scenarios demonstrate practical Kubernetes troubleshooting across application startup, service discovery, network security, persistent storage, configuration, RBAC, and container security.

The key lesson is to troubleshoot systematically: gather evidence, identify the failing layer, understand the root cause, apply a targeted fix, and verify the result.

That approach is essential for operating reliable and secure Kubernetes workloads in real Cloud / DevOps / DevSecOps environments.

