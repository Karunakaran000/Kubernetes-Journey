# CloudCart Lite — Kubernetes Implementation Guide

## 1. Overview

This document explains how CloudCart Lite is deployed and operated on Kubernetes.

CloudCart is a three-tier application consisting of:

* **Frontend:** React application served by NGINX.
* **Backend:** Java 21 and Spring Boot REST API.
* **Database:** PostgreSQL.

The project uses Kubernetes Deployments, StatefulSets, Services, Ingress, persistent storage, ConfigMaps, Secrets, RBAC, NetworkPolicies, and SecurityContexts.

The focus is on understanding how resources work together, how to verify their behavior, and how to troubleshoot failures.

## 2. Prerequisites

The local lab uses:

* Docker Desktop with WSL2 integration.
* Ubuntu on WSL2.
* `kubectl`.
* `kind`.
* Docker images published to Docker Hub.

Verify the tools:

```bash
docker --version
kubectl version --client
kind version
```

Verify the cluster:

```bash
kubectl config current-context
kubectl get nodes -o wide
```

The expected context is:

```text
kind-k8s-journey
```

If your context or cluster name differs, verify your configuration before applying manifests.

## 3. Repository Structure

The repository organizes the project manifests by application component and operational concern.

```text
Kubernetes-Journey/
├── cloudcart/
│   └── k8s/
│       ├── namespace.yaml
│       ├── frontend/
│       ├── backend/
│       ├── postgres/
│       ├── networking/
│       │   ├── ingress.yaml
│       │   └── networkpolicies.yaml
│       ├── storage/
│       │   └── statefulset-volumeclaims.yaml
│       └── security/
│           ├── configmap-demo.yaml
│           ├── configmap-env-demo.yaml
│           ├── configmap-volume-demo.yaml
│           ├── serviceaccount.yaml
│           ├── backend-role.yaml
│           ├── backend-rolebinding.yaml
│           └── securitycontext-demo.yaml
└── docs/
```

Keep the real frontend, backend, and PostgreSQL manifests in their respective directories. Keep the demonstration manifests separate from the core application manifests so that a lab exercise does not accidentally change the main application.

## 4. Kubernetes Namespace

The `cloudcart` namespace groups application resources together.

Check it:

```bash
kubectl get namespace cloudcart
```

A namespace helps organize resources and scope many Kubernetes operations. It is not, by itself, a complete security boundary.

## 5. Deploying CloudCart

Apply the application manifests in dependency order, using the actual manifest filenames in your repository.

### Step 1 — Create the namespace

```bash
kubectl apply -f cloudcart/k8s/namespace.yaml
```

### Step 2 — Create database configuration and storage

Create the PostgreSQL Secret and PVC before starting the database workload:

```bash
kubectl apply -f cloudcart/k8s/postgres/secret.yaml
kubectl apply -f cloudcart/k8s/postgres/pvc.yaml
```

Apply the PostgreSQL Service and StatefulSet manifests using the filenames in your repository.

**Why this order?** The database needs its credentials and persistent storage configuration before it starts. Kubernetes can often resolve dependencies eventually, but deliberate ordering makes initial deployment easier to understand and troubleshoot.

### Step 3 — Deploy the backend

Apply the backend Deployment and Service manifests.

The backend connects to PostgreSQL through:

```text
postgres-service:5432
```

It should obtain its database settings from the intended Secret rather than hardcoding credentials in the application image.

### Step 4 — Deploy the frontend

Apply the frontend Deployment and Service manifests.

The frontend Service exposes HTTP on port 80. Its NGINX configuration proxies `/api/` requests to:

```text
http://backend-service:8080
```

### Step 5 — Apply networking rules

Apply the Ingress and NetworkPolicy manifests after verifying that the required Services, Pod labels, namespaces, and ports match the rules.

```bash
kubectl apply -f cloudcart/k8s/networking/ingress.yaml
kubectl apply -f cloudcart/k8s/networking/networkpolicies.yaml
```

The Ingress Controller must also be installed and running for Ingress rules to take effect.

> **Important:** The commands above assume these files exist at the documented paths. Confirm the filenames in your repository before running them. The security directory also contains independent lab exercises; don't apply every YAML file indiscriminately.

## 6. Verify the Workloads

### Check Pods

```bash
kubectl get pods -n cloudcart -o wide
```

Look for:

* `Running` status.
* `1/1` readiness for each single-container Pod.
* Unexpected restarts.
* Pod IP addresses and node placement.

A `Running` Pod is not necessarily ready to serve requests. Check the `READY` column and probe results as well.

### Check Deployments and StatefulSets

```bash
kubectl get deployments -n cloudcart
kubectl get replicasets -n cloudcart
kubectl get statefulsets -n cloudcart
```

Deployments manage the frontend and backend replicas. The StatefulSet manages the PostgreSQL workload.

### Check Services and endpoints

```bash
kubectl get services -n cloudcart
kubectl get endpointslices -n cloudcart
```

Services provide stable virtual endpoints. EndpointSlices show the backend endpoints associated with Services.

If a Service has no usable endpoints, check its selector, Pod labels, readiness, and NetworkPolicies.

### Check database storage

```bash
kubectl get pvc -n cloudcart
kubectl get pv
kubectl get storageclass
```

The PostgreSQL PVC should be `Bound`.

The local `standard` StorageClass uses the local-path provisioner in this kind lab. It is not equivalent to replicated, highly available cloud storage.

## 7. Application Health Verification

### Backend logs

```bash
kubectl logs deployment/cloudcart-backend -n cloudcart
```

The Deployment name must match the actual name in your manifests.

### Backend health endpoint

Use the backend Pod or a temporary port-forward to verify the health endpoint.

For example:

```bash
kubectl port-forward -n cloudcart service/backend-service 8082:8080
```

In another terminal:

```bash
curl -i http://localhost:8082/actuator/health
```

Stop the port-forward with `Ctrl+C` when finished.

### Product API

With the backend port-forward still running:

```bash
curl -i http://localhost:8082/api/products
```

The product API should return a successful HTTP response when the backend and database are healthy.

The `/api/health` endpoint is not the application's verified health endpoint; use `/actuator/health` for this deployment.

## 8. Access CloudCart Through a Browser

The simplest local access method is Kubernetes port forwarding.

Run:

```bash
kubectl port-forward -n cloudcart service/frontend-service 8080:80
```

Expected output resembles:

```text
Forwarding from 127.0.0.1:8080 -> 80
Forwarding from [::1]:8080 -> 80
```

Keep this terminal open while using the application.

Open the following address in your browser:

**http://localhost:8080**

The request path is:

```text
Browser
   |
   v
localhost:8080
   |
   v
kubectl port-forward
   |
   v
frontend-service:80
   |
   v
Frontend Pod (NGINX)
   |
   +---- /       → React application
   |
   +---- /api/   → backend-service:8080
                         |
                         v
                    Backend Pod
                         |
                         v
                   PostgreSQL
```

The port-forward is a local access tunnel, not a permanent production exposure mechanism. It must remain running while you use the application.

### If the browser doesn't load

Check the frontend Service and Pods:

```bash
kubectl get service frontend-service -n cloudcart
kubectl get pods -n cloudcart -l app=cloudcart-frontend
kubectl get endpointslices -n cloudcart
```

Inspect the frontend logs:

```bash
kubectl logs deployment/cloudcart-frontend -n cloudcart
```

If the page loads but products do not, inspect the browser's developer tools and test the backend API. Also verify that NetworkPolicies allow frontend-to-backend traffic.

## 9. Ingress Routing

The project defines these routes:

| Request path | Destination            |
| ------------ | ---------------------- |
| `/`          | `frontend-service:80`  |
| `/api`       | `backend-service:8080` |

Ingress is useful when multiple HTTP routes need to share an entry point.

A key distinction:

* An **Ingress resource** defines routing rules.
* An **Ingress Controller** processes those rules.
* A **Service** provides a stable endpoint for a set of Pods.

In the local kind environment, a configured Ingress address does not guarantee that the Windows host can reach it directly. Host port mappings and the local network configuration determine external reachability. Port forwarding remains the straightforward browser-access method for this lab.

## 10. Persistent Database Storage

The PostgreSQL workload mounts its persistent volume at:

```text
/var/lib/postgresql/data
```

The storage chain is:

```text
PostgreSQL container
        |
        v
PersistentVolumeClaim
        |
        v
PersistentVolume
        |
        v
StorageClass / provisioner
        |
        v
Local storage on the kind node
```

The persistence experiment demonstrated that product records remained available after the PostgreSQL Pod was deleted and recreated.

This illustrates the difference between Pod lifecycle and persistent data lifecycle. It does not prove that the database is protected against node loss, disk failure, or accidental PVC deletion.

Production systems require separate backup, recovery, and restore-validation strategies.

## 11. Configuration and Security

### ConfigMaps

ConfigMaps store non-sensitive settings outside the application image.

The lab demonstrates two ways to consume them:

* Environment variables.
* Mounted files.

Environment variables in an already-running container do not update automatically when a ConfigMap changes. Mounted files may update eventually, but the application must reread them to use new values.

### Secrets

The PostgreSQL Secret supplies database credentials to the database workload and backend configuration.

Base64 encoding is not encryption. Production use requires appropriate RBAC, encryption-at-rest configuration, access restrictions, and consideration of managed secret services.

Do not commit real credentials to a public repository. The demonstration credentials are lab values and must never be reused for a production environment.

### RBAC

The project demonstrates a ServiceAccount bound to a namespace-scoped Role that permits reading Pods.

The permissions were verified using:

```bash
kubectl auth can-i get pods \
  --as=system:serviceaccount:cloudcart:cloudcart-backend \
  -n cloudcart
```

The lab identity was denied permission to delete Pods and read Secrets.

This verifies Kubernetes RBAC behavior. It does not test AWS IAM permissions.

### SecurityContext

The SecurityContext exercise demonstrates non-root execution, a default seccomp profile, disabled privilege escalation, and dropped Linux capabilities.

The exercise also showed that Kubernetes can refuse to start a container when `runAsNonRoot: true` conflicts with an image that defaults to root.

## 12. NetworkPolicy Verification

The project uses a default-deny policy model and explicit rules for required communication.

Inspect the policies:

```bash
kubectl get networkpolicies -n cloudcart
kubectl describe networkpolicy -n cloudcart
```

If communication fails, verify both sides of the connection:

1. Does the source Pod's egress policy allow the destination and port?
2. Does the destination Pod's ingress policy allow the source and port?
3. Do DNS rules permit name resolution?
4. Do Service selectors and endpoints match the intended Pods?
5. Is the cluster's network plugin enforcing NetworkPolicies?

The presence of a NetworkPolicy object does not by itself prove that its rules are enforced correctly by the network dataplane.

## 13. Operational Troubleshooting

### Pod is not starting

```bash
kubectl get pods -n cloudcart
kubectl describe pod <pod-name> -n cloudcart
kubectl get events -n cloudcart --sort-by=.metadata.creationTimestamp
```

Inspect scheduling errors, image pull failures, configuration references, and container state.

### Pod is repeatedly restarting

```bash
kubectl logs <pod-name> -n cloudcart
kubectl logs <pod-name> -n cloudcart --previous
kubectl describe pod <pod-name> -n cloudcart
```

Look for startup errors, failed probes, memory exhaustion, and dependency failures.

### Service is unreachable

```bash
kubectl get service -n cloudcart
kubectl get endpointslices -n cloudcart
kubectl get pods -n cloudcart --show-labels
```

Verify selectors, ports, target ports, Pod readiness, DNS, and NetworkPolicies.

### Database connection fails

Check the backend logs, PostgreSQL Pod status, Secret references, Service endpoints, port 5432 connectivity, and database readiness.

Avoid changing multiple resources at once. Identify the failing layer, make one targeted correction, and verify recovery.

## 14. Production Considerations

The local cluster is a learning environment, not a complete production platform.

A production deployment would additionally consider:

* Multiple worker nodes and failure-domain distribution.
* Availability across multiple Availability Zones.
* Managed database infrastructure and verified backups.
* TLS and appropriate ingress or gateway configuration.
* Workload identity and least-privilege AWS IAM.
* Centralized logs, metrics, alerts, and dashboards.
* Capacity planning and autoscaling.
* Controlled deployments and rollback procedures.
* Container image scanning and software supply-chain security.
* Policy enforcement and secure secret management.

These capabilities form the direction for the project's continued development with AWS, CI/CD, and DevSecOps.

## Conclusion

CloudCart Lite provides hands-on experience with Kubernetes workloads, networking, storage, configuration, security, health checks, and troubleshooting.

The central engineering lesson is that a successful deployment is not just a collection of running Pods. The application must also have correct routing, usable endpoints, persistent data, suitable permissions, health checks, and a repeatable way to diagnose failures.

