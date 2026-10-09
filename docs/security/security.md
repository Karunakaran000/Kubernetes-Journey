# CloudCart Lite — Kubernetes Security Guide

## 1. Overview

Security is a core part of deploying and operating CloudCart Lite on Kubernetes.

The project demonstrates how to reduce unnecessary access, isolate application traffic, protect sensitive configuration, and restrict container privileges.

The security model follows the principle of **least privilege**: each workload should receive only the permissions and connectivity required for its function.

This guide covers the security controls implemented in the local Kubernetes lab and explains how they relate to production Cloud / DevOps / DevSecOps engineering.

## 2. Security Architecture

```text
                    Kubernetes Cluster
                           |
            +--------------+--------------+
            |              |              |
            v              v              v
        Identity        Networking     Containers
            |              |              |
            v              v              v
      ServiceAccount   NetworkPolicy  SecurityContext
            |              |              |
            v              v              v
          RBAC        Allowed traffic  Restricted access
            |
            v
     Kubernetes API

       Additional security layers
                |
        +-------+--------+
        |                |
        v                v
    ConfigMaps         Secrets
        |                |
 Non-sensitive      Sensitive config

     Admission policies
             |
             v
  Reject non-compliant workloads
```

These controls solve different problems and complement one another.

| Control                      | Security purpose                                             |
| ---------------------------- | ------------------------------------------------------------ |
| ConfigMap                    | Separate non-sensitive configuration from application images |
| Secret                       | Supply sensitive configuration to authorized workloads       |
| ServiceAccount               | Identify a workload to the Kubernetes API                    |
| RBAC                         | Control Kubernetes API permissions                           |
| NetworkPolicy                | Restrict Pod ingress and egress traffic                      |
| SecurityContext              | Restrict container and process privileges                    |
| Resource requests and limits | Manage resource consumption and reduce noisy-neighbor impact |
| Admission policies           | Enforce rules before workloads are admitted                  |

No single control provides complete workload security.

## 3. ConfigMaps — Configuration Separation

ConfigMaps store non-sensitive configuration outside the container image.

The CloudCart lab demonstrated:

* Creating a ConfigMap.
* Injecting its values as container environment variables.
* Mounting its values as files.
* Updating a ConfigMap and observing how running workloads respond.

Example:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cloudcart-config-demo
  namespace: cloudcart
data:
  APP_ENV: "development"
  LOG_LEVEL: "INFO"
  APP_NAME: "CloudCart"
```

### Why this matters

The same container image can be promoted between environments while configuration is supplied separately.

This supports immutable images and repeatable deployments.

### Operational considerations

* Do not put passwords, tokens, or private keys in ConfigMaps.
* Environment variables populated from a ConfigMap do not automatically update in a running container.
* Mounted ConfigMap files can update eventually, but the application must reread the files.
* Use version-controlled manifests and deliberate rollout procedures to avoid configuration drift.

For AWS deployments, non-sensitive parameters may also be managed through AWS Systems Manager Parameter Store, depending on the design.

## 4. Secrets — Protecting Sensitive Configuration

CloudCart uses a Kubernetes Secret to provide PostgreSQL configuration, including database credentials.

Example:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: postgres-secret
  namespace: cloudcart
type: Opaque
stringData:
  POSTGRES_DB: cloudcart
  POSTGRES_USER: cloudcart
  POSTGRES_PASSWORD: cloudcartpass
```

These are demonstration credentials, not production credentials.

### Base64 is not encryption

Kubernetes may represent Secret values under `data` using Base64 encoding. Base64 is reversible encoding, not encryption.

Anyone who can decode a Base64 value can recover its original text.

### Security requirements

* Never commit real credentials to a public Git repository.
* Restrict Secret access with RBAC.
* Configure appropriate encryption at rest for the Kubernetes datastore.
* Limit which workloads can access each Secret.
* Rotate credentials when required.
* Avoid printing sensitive values into logs or terminal transcripts.

### Production direction

For AWS, a production design may use AWS Secrets Manager, AWS Systems Manager Parameter Store, AWS KMS, and an appropriate workload identity mechanism.

The correct choice depends on whether the value is a secret or a non-sensitive parameter, how it must be rotated, and which workloads need access.

## 5. ServiceAccounts — Workload Identity

A ServiceAccount provides an identity for a workload that needs to interact with the Kubernetes API.

CloudCart includes a ServiceAccount named:

```text
cloudcart-backend
```

It is defined in the `cloudcart` namespace.

A ServiceAccount does not automatically grant broad permissions. The identity must receive appropriate permissions through RBAC.

### Verify the identity

```bash
kubectl get serviceaccounts -n cloudcart
```

Inspect the ServiceAccount used by a Pod:

```bash
kubectl get pod <pod-name> -n cloudcart \
  -o jsonpath='{.spec.serviceAccountName}{"\n"}'
```

Creating the `cloudcart-backend` ServiceAccount does not automatically make the existing backend Deployment use it. The Deployment's Pod template must specify:

```yaml
spec:
  template:
    spec:
      serviceAccountName: cloudcart-backend
```

Only apply that change when the workload configuration is intended to use the identity.

### Production lesson

Use dedicated workload identities rather than sharing unnecessary permissions through a default identity.

For AWS workloads on EKS, Kubernetes ServiceAccounts and AWS IAM identities are separate concepts. EKS Pod Identity or IAM Roles for Service Accounts (IRSA) can connect workload identity to AWS permissions, depending on the chosen architecture.

## 6. RBAC — Least-Privilege API Access

Role-Based Access Control determines which Kubernetes API operations an identity is permitted to perform.

CloudCart includes:

* A namespace-scoped Role named `cloudcart-pod-reader`.
* A RoleBinding named `cloudcart-backend-pod-reader`.
* A ServiceAccount named `cloudcart-backend`.

The Role permits these operations on Pods:

```yaml
rules:
  - apiGroups:
      - ""
    resources:
      - pods
    verbs:
      - get
      - list
      - watch
```

### Permission testing

Check whether the ServiceAccount can read Pods:

```bash
kubectl auth can-i get pods \
  --as=system:serviceaccount:cloudcart:cloudcart-backend \
  -n cloudcart
```

The lab returned `yes`.

Check whether it can delete Pods:

```bash
kubectl auth can-i delete pods \
  --as=system:serviceaccount:cloudcart:cloudcart-backend \
  -n cloudcart
```

The lab returned `no`.

Check whether it can read Secrets:

```bash
kubectl auth can-i get secrets \
  --as=system:serviceaccount:cloudcart:cloudcart-backend \
  -n cloudcart
```

The lab returned `no`.

### Role versus ClusterRole

* **Role:** defines permissions within a namespace.
* **ClusterRole:** can define permissions for cluster-scoped resources or reusable permissions that may be bound in a namespace or cluster scope.
* **RoleBinding:** grants the referenced permissions within its namespace.
* **ClusterRoleBinding:** grants the referenced ClusterRole permissions across the cluster scope.

Prefer namespace-scoped permissions when they are sufficient.

### Important distinction

Kubernetes RBAC controls Kubernetes API access. It does not grant permissions to call AWS APIs such as S3, EC2, or Secrets Manager. AWS IAM and workload identity handle that separate authorization layer.

## 7. NetworkPolicies — Restricting Network Access

CloudCart uses a default-deny approach with explicit rules for required communication.

The intended traffic includes:

```text
Ingress Controller → Frontend
Ingress Controller → Backend
Frontend           → Backend
Backend            → PostgreSQL
Application Pods   → CoreDNS
```

Unnecessary traffic, such as arbitrary Pods connecting to PostgreSQL, should be blocked.

### How NetworkPolicy enforcement works

A NetworkPolicy selects Pods and defines allowed ingress and/or egress traffic.

When the source Pod is egress-isolated and the destination Pod is ingress-isolated, both policies must allow the connection.

Policies are additive: the allowed traffic is the combined result of the applicable policies.

### Inspect the policies

```bash
kubectl get networkpolicies -n cloudcart
kubectl describe networkpolicy -n cloudcart
```

Inspect the Services and their endpoints:

```bash
kubectl get services -n cloudcart
kubectl get endpointslices -n cloudcart
```

### Security considerations

* Match the correct Pod labels and namespaces.
* Permit required DNS traffic when egress is restricted.
* Avoid opening all ports simply to make connectivity work.
* Test permitted and denied communication paths.
* Verify that the installed network plugin actually enforces NetworkPolicies.

A NetworkPolicy object existing in the API does not, by itself, prove the network dataplane is enforcing the policy correctly.

## 8. SecurityContext — Restricting Container Privileges

SecurityContext configures security-related properties for Pods and containers.

The CloudCart demonstration uses:

```yaml
securityContext:
  runAsUser: 1000
  runAsGroup: 1000
  runAsNonRoot: true
  seccompProfile:
    type: RuntimeDefault
```

At the container level:

```yaml
securityContext:
  allowPrivilegeEscalation: false
  capabilities:
    drop:
      - ALL
```

### What these settings achieve

* `runAsUser`: selects the process user ID.
* `runAsGroup`: selects the primary group ID.
* `runAsNonRoot`: requires non-root execution.
* `seccompProfile: RuntimeDefault`: requests the container runtime's default seccomp profile.
* `allowPrivilegeEscalation: false`: prevents processes from gaining additional privileges through mechanisms covered by this setting.
* `capabilities.drop: [ALL]`: removes Linux capabilities from the container process.

### The non-root failure experiment

Initially, the Pod could not start because the BusyBox image defaulted to root while `runAsNonRoot: true` was configured.

The error was expected: the security requirement and image defaults contradicted one another.

The demonstration was corrected by specifying UID and GID `1000`. The resulting process identity was:

```text
uid=1000 gid=1000 groups=1000
```

This verified non-root execution in the lab.

### Production considerations

Do not blindly assign UID `1000` to every workload. Use an image designed for non-root execution, check filesystem permissions, and select the identity appropriate for the application.

SecurityContext is a runtime configuration control. It does not independently enforce every organization-wide security policy.

## 9. Resource Controls and Workload Isolation

CPU and memory requests and limits help manage resource allocation and consumption.

CloudCart's workloads use configured requests and limits to demonstrate these controls.

### Requests

Requests influence scheduling and help Kubernetes make capacity decisions.

### Limits

Limits constrain resource consumption. CPU limits can cause throttling; exceeding a container's memory limit can result in an OOM kill.

### Security and reliability relationship

Unbounded workloads can consume shared node resources and affect other applications. Appropriate resource controls reduce this risk, but must be paired with monitoring, capacity planning, and suitable sizing.

Useful commands:

```bash
kubectl describe pod <pod-name> -n cloudcart
kubectl get pods -n cloudcart -o wide
kubectl top pods -n cloudcart
```

`kubectl top` requires a working Metrics API.

## 10. Admission Policies — Enforcing Security Before Runtime

Admission controllers evaluate API requests after authentication and authorization, before the API server persists accepted objects.

This enables policy enforcement before an application workload is created.

Examples of useful rules include:

* Reject privileged containers.
* Require non-root execution where appropriate.
* Require approved image registries.
* Require resource requests and limits.
* Restrict host-level access.
* Require appropriate labels and security settings.

### Pod Security Admission

Kubernetes includes a built-in Pod Security Admission controller. Namespace labels can select one of three Pod Security Standards:

| Level        | Purpose                                                |
| ------------ | ------------------------------------------------------ |
| `privileged` | Unrestricted policy for trusted system-level workloads |
| `baseline`   | Blocks common privilege-escalation configurations      |
| `restricted` | Applies stronger Pod-hardening requirements            |

The `enforce`, `audit`, and `warn` modes support different stages of policy adoption. Enforcement rejects non-compliant Pod creation requests; warnings inform users, while audit mode records policy violations for auditing.

Official documentation: [Enforce Pod Security Standards with Namespace Labels](https://kubernetes.io/docs/tasks/configure-pod-container/enforce-standards-namespace-labels/).

### Current project status

This project has demonstrated SecurityContext controls and discussed admission policy design. Pod Security Admission enforcement has not yet been demonstrated as part of the CloudCart lab.

A future hands-on exercise can create a separate test namespace, enforce the `restricted` standard, and compare a rejected insecure Pod with a compliant Pod. A dedicated namespace avoids unexpectedly disrupting the existing CloudCart workloads.

For more advanced organizational policy, tools such as Kyverno or OPA Gatekeeper can provide additional policy capabilities.

## 11. Production Security Checklist

Before deploying a workload into a production environment, evaluate the following:

* [ ] The container runs as a non-root user where supported.
* [ ] Privilege escalation is disabled unless explicitly justified.
* [ ] Unnecessary Linux capabilities are dropped.
* [ ] The workload has appropriate resource requests and limits.
* [ ] ServiceAccounts are dedicated and minimally privileged.
* [ ] RBAC permissions are restricted to required API resources and verbs.
* [ ] NetworkPolicies permit only required communication.
* [ ] Sensitive values are not stored in public source control.
* [ ] Secret access and encryption at rest are appropriately configured.
* [ ] Images come from trusted registries and are scanned.
* [ ] Admission policies enforce the organization's workload standards.
* [ ] Logs and monitoring do not expose secrets.
* [ ] Security changes are tested and reviewed before production rollout.

These controls should be integrated into repeatable deployment workflows instead of depending entirely on manual checks.

## 12. AWS and DevSecOps Direction

The local project provides a foundation for applying security controls in a managed cloud environment.

A future AWS deployment can extend the model with:

* Amazon EKS for managed Kubernetes control-plane operations.
* AWS IAM and EKS Pod Identity or IRSA for workload permissions.
* AWS Secrets Manager and AWS KMS for sensitive configuration and encryption.
* Amazon ECR for container image storage and scanning capabilities.
* Terraform for repeatable infrastructure provisioning.
* GitHub Actions for automated testing and security checks.
* GitOps-based deployment controls.
* Centralized logging, monitoring, and policy enforcement.

The exact combination should be selected based on security requirements, availability objectives, cost, and operational needs.

## Conclusion

CloudCart Lite demonstrates several important Kubernetes security principles: configuration separation, controlled access to the Kubernetes API, restricted network communication, persistent storage awareness, and reduced container privileges.

The main lesson is that security requires multiple layers. ServiceAccounts and RBAC control API access; NetworkPolicies control Pod traffic; SecurityContexts restrict process privileges; Secrets protect sensitive configuration when used with appropriate access and encryption controls; and admission policies can prevent non-compliant workloads from being created.

These concepts form the security foundation for the project's further development with AWS, CI/CD, and DevSecOps.

