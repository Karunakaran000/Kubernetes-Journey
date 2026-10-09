# CloudCart Lite — Kubernetes Architecture

## Cloud / DevOps / DevSecOps Portfolio Project

CloudCart Lite is a lightweight three-tier web application deployed on Kubernetes to demonstrate workload orchestration, service discovery, networking, persistent storage, health monitoring, resource management, troubleshooting, and workload security.

The application consists of a React frontend served by NGINX, a Java Spring Boot backend, and a PostgreSQL database.

The primary objective is to demonstrate how a Cloud / DevOps / DevSecOps engineer deploys, operates, secures, and troubleshoots an application on Kubernetes.

---

## 1. Architecture Overview

```text
                         User / Browser
                               |
                               | HTTP
                               v
                    Kubernetes Port Forward
                               |
                               v
                     frontend-service
                         ClusterIP
                               |
                               v
                    +--------------------+
                    |   Frontend Pods    |
                    |                    |
                    | React + NGINX      |
                    | 2 replicas         |
                    +---------+----------+
                              |
                              | Kubernetes Service
                              | frontend → backend
                              v
                    +--------------------+
                    |    Backend Pods    |
                    |                    |
                    | Java 21            |
                    | Spring Boot        |
                    | REST API           |
                    | 2 replicas         |
                    +---------+----------+
                              |
                              | TCP 5432
                              v
                    +--------------------+
                    | PostgreSQL Service |
                    | ClusterIP          |
                    +---------+----------+
                              |
                              v
                    +--------------------+
                    | PostgreSQL         |
                    | StatefulSet        |
                    | 1 replica          |
                    +---------+----------+
                              |
                              v
                    PersistentVolumeClaim
                              |
                              v
                       PersistentVolume
                              |
                              v
                  kind local-path storage
```

The application runs in a dedicated Kubernetes namespace named `cloudcart`.

The local Kubernetes cluster is created using `kind`, which runs Kubernetes nodes as containers through Docker.

**Important:** This is a local learning environment, not a production high-availability cluster. Although the frontend and backend have multiple replicas, the current kind cluster has only one Kubernetes node.

---

## 2. Technology Stack

| Layer                        | Technology                      |
| ---------------------------- | ------------------------------- |
| Frontend                     | React                           |
| Web server and reverse proxy | NGINX                           |
| Backend                      | Java 21                         |
| Application framework        | Spring Boot                     |
| API                          | REST                            |
| Database                     | PostgreSQL 17                   |
| Container images             | Docker                          |
| Image registry               | Docker Hub                      |
| Container orchestration      | Kubernetes                      |
| Local cluster                | kind                            |
| Kubernetes networking        | kindnet CNI                     |
| Service discovery            | Kubernetes Services and CoreDNS |
| External HTTP routing        | NGINX Ingress Controller        |
| Persistent storage           | PVC, PV, StorageClass           |
| Configuration                | ConfigMaps                      |
| Sensitive configuration      | Kubernetes Secrets              |
| Workload identity            | ServiceAccounts                 |
| Authorization                | Kubernetes RBAC                 |
| Network security             | NetworkPolicies                 |
| Container security           | SecurityContext                 |
| Local operating environment  | WSL2 Ubuntu and Docker Desktop  |

---

## 3. Kubernetes Environment

The local environment uses the following architecture:

```text
Windows Host
     |
     v
WSL2 Ubuntu
     |
     v
Docker Desktop
     |
     v
kind Kubernetes Node
     |
     +-- Kubernetes API Server
     +-- Scheduler
     +-- Controller Manager
     +-- containerd
     +-- kindnet CNI
     +-- CoreDNS
     +-- Application Workloads
```

### Cluster characteristics

* Cluster: `k8s-journey`
* Context: `kind-k8s-journey`
* Node: `k8s-journey-control-plane`
* Kubernetes namespace: `cloudcart`
* Container runtime: containerd
* Pod networking: kindnet

The kind node is itself a Docker container. Kubernetes workload containers run inside the node's container runtime.

Useful commands:

```bash
kubectl config current-context
kubectl get nodes -o wide
kubectl get pods -n cloudcart -o wide
kubectl get services -n cloudcart
```

These commands help verify the active cluster, node health, workload placement, and application networking.

---

## 4. Application Request Flow

### Frontend request

1. A user opens CloudCart through a browser.
2. A local `kubectl port-forward` session forwards a host port to the frontend Service.
3. The frontend Service selects eligible frontend Pods.
4. NGINX serves the React static application.
5. The browser displays the CloudCart interface.

### Backend API request

The frontend communicates with the backend through Kubernetes networking.

```text
Browser
   |
   v
Frontend NGINX
   |
   | /api/*
   v
backend-service:8080
   |
   v
Backend Pod
   |
   v
postgres-service:5432
   |
   v
PostgreSQL
```

The backend exposes product API endpoints, including:

```text
GET /api/products
GET /api/products/{id}
```

The application also exposes Spring Boot Actuator health information at:

```text
/actuator/health
```

The API and health endpoints serve different purposes: the product endpoints support application functionality, while Actuator supports operational health checks.

---

## 5. Kubernetes Workload Design

### Frontend — Deployment

The frontend runs as a Deployment with two replicas.

Responsibilities:

* Serve the React application through NGINX.
* Provide a stable Service endpoint.
* Replace Pods when managed replicas become unavailable.
* Support rolling updates when the Pod template changes.
* Use resource requests and limits.

### Backend — Deployment

The backend runs as a Deployment with two replicas.

Responsibilities:

* Process REST API requests.
* Communicate with PostgreSQL.
* Read database configuration from Kubernetes Secrets.
* Expose application health through Actuator.
* Use startup, readiness, and liveness probes.
* Use CPU and memory requests and limits.

The startup probe accommodates the application's relatively slow startup. Readiness controls whether a Pod should receive Service traffic, while liveness detects certain unhealthy application states and can trigger container restarts.

### PostgreSQL — StatefulSet

PostgreSQL runs as a StatefulSet with one replica.

Responsibilities:

* Maintain a stable Pod identity.
* Use persistent storage for database files.
* Obtain database settings from a Secret.
* Use readiness and liveness checks.
* Remain accessible through an internal Service.

PostgreSQL is intentionally deployed inside Kubernetes for this learning environment. In a production AWS design, a managed database such as Amazon RDS for PostgreSQL would often be preferred.

---

## 6. Kubernetes Networking

### Services

CloudCart uses internal ClusterIP Services:

| Service            | Port | Purpose            |
| ------------------ | ---: | ------------------ |
| `frontend-service` |   80 | Frontend access    |
| `backend-service`  | 8080 | Backend API access |
| `postgres-service` | 5432 | PostgreSQL access  |

Services provide stable virtual endpoints and select matching Pods using labels.

Pod IP addresses can change when Pods are replaced. Applications therefore use Service names rather than hardcoded Pod IP addresses.

Examples:

```text
backend-service:8080
postgres-service:5432
```

CoreDNS resolves Kubernetes Service names to their corresponding Service addresses.

### Ingress

The `cloudcart-ingress` resource uses the NGINX Ingress Controller to define HTTP routing:

| Path   | Destination            |
| ------ | ---------------------- |
| `/api` | `backend-service:8080` |
| `/`    | `frontend-service:80`  |

The Ingress resource defines routing rules; the Ingress Controller implements them.

In this local kind environment, the Ingress Controller is not backed by a cloud load balancer. Its NodePort and host-network reachability depend on the local cluster configuration.

### NetworkPolicies

NetworkPolicies restrict which workloads can communicate.

The CloudCart policies implement a default-deny approach and explicitly permit required communication, including:

* DNS queries to CoreDNS.
* Frontend-to-backend traffic.
* Backend-to-PostgreSQL traffic.
* Ingress Controller traffic to the frontend and backend.

Both the source Pod's egress policy and the destination Pod's ingress policy must permit a connection when both endpoints are isolated by NetworkPolicies.

These controls depend on the cluster's network implementation enforcing NetworkPolicies correctly.

---

## 7. Persistent Storage Architecture

PostgreSQL stores its data in persistent storage rather than relying on the container's writable filesystem.

```text
PostgreSQL
    |
    v
/var/lib/postgresql/data
    |
    v
PersistentVolumeClaim
    |
    v
PersistentVolume
    |
    v
StorageClass: standard
    |
    v
local-path provisioner
    |
    v
kind node local filesystem
```

The PostgreSQL PVC requests 2 GiB of storage.

The current StorageClass uses the `rancher.io/local-path` provisioner. This is local lab storage, not replicated cloud storage.

The project also includes a separate StatefulSet experiment using `volumeClaimTemplates` to demonstrate per-Pod PVCs and the relationship between StatefulSet identity and persistent storage.

Key operational lessons:

* A container restart does not inherently delete persistent data.
* A Pod replacement can reconnect to its persistent volume.
* StatefulSet scale-down does not automatically mean its PVCs are deleted.
* PVC deletion can lead to underlying storage deletion depending on the reclaim policy and provisioner.
* Persistence does not replace backups, point-in-time recovery, or restore testing.

---

## 8. Configuration and Security Architecture

CloudCart uses Kubernetes-native configuration and workload security controls.

### ConfigMaps

ConfigMaps store non-sensitive configuration separately from application images.

The learning exercises demonstrate injecting values as environment variables and mounting ConfigMap values as files.

Environment variables already supplied to a running container do not automatically change when the ConfigMap is updated. Mounted ConfigMap files can update eventually, but applications must reread them to use the new values.

### Secrets

Kubernetes Secrets provide a resource for sensitive configuration, including PostgreSQL credentials.

Base64 encoding is not encryption. Production deployments should protect Secrets through appropriate encryption at rest, RBAC, restricted access, and integration with a dedicated secret-management system where appropriate.

### ServiceAccounts and RBAC

ServiceAccounts provide identities for workloads that interact with the Kubernetes API.

A namespace-scoped Role and RoleBinding demonstrate least-privilege access. The lab identity can read Pods but cannot delete Pods or read Secrets.

Kubernetes RBAC governs Kubernetes API permissions. Access to AWS APIs is a separate authorization concern that requires AWS IAM and an appropriate workload identity integration.

### SecurityContext

The security exercise configures:

* A non-root user and group.
* `runAsNonRoot: true`.
* `seccompProfile: RuntimeDefault`.
* `allowPrivilegeEscalation: false`.
* Dropping all Linux capabilities.

The exercise also demonstrates how Kubernetes can reject a container configuration that requests non-root execution when the image defaults to root.

### Resource controls

CPU and memory requests and limits help manage scheduling and runtime resource consumption. They do not replace monitoring, capacity planning, or autoscaling.

---

## 9. Reliability and Health Monitoring

The project uses several Kubernetes mechanisms to improve workload reliability:

| Mechanism             | Purpose                                        |
| --------------------- | ---------------------------------------------- |
| Deployment replicas   | Maintain the desired Pod count                 |
| ReplicaSet            | Reconcile the number of Pods                   |
| Rolling updates       | Progress between application versions          |
| Rollback              | Restore a previous Deployment template         |
| Startup probe         | Allow time for slow application startup        |
| Readiness probe       | Control whether a Pod receives Service traffic |
| Liveness probe        | Detect certain unhealthy application states    |
| Resource requests     | Inform scheduling and capacity decisions       |
| Resource limits       | Bound container resource consumption           |
| StatefulSet           | Provide stable identity for stateful workloads |
| PersistentVolumeClaim | Request persistent storage                     |

These features improve recovery and operational control, but two replicas on one node do not provide node-level high availability.

High availability across nodes, disruption budgets, autoscaling, and production failure testing are areas for subsequent development.

---

## 10. Troubleshooting Approach

The project uses a structured operational troubleshooting process:

```text
Identify the symptom
        |
        v
Check workload and Pod status
        |
        v
Inspect Events and describe output
        |
        v
Review application and controller logs
        |
        v
Verify labels, selectors, and endpoints
        |
        v
Check DNS, network policy, and ports
        |
        v
Check probes, resources, and configuration
        |
        v
Inspect storage and dependencies
        |
        v
Identify the root cause
        |
        v
Apply a targeted fix
        |
        v
Verify recovery
```

Useful commands:

```bash
kubectl get pods -n cloudcart -o wide
kubectl describe pod <pod-name> -n cloudcart
kubectl logs <pod-name> -n cloudcart
kubectl get events -n cloudcart --sort-by=.metadata.creationTimestamp
kubectl get services,endpointslices -n cloudcart
kubectl get networkpolicies -n cloudcart
kubectl get pvc,pv -n cloudcart
```

The objective is not simply to make a workload run. It is to understand why it failed, how the failure was detected, and how to verify that the fix resolved the underlying problem.

---

## 11. Engineering Decisions

| Decision                             | Reason                                                        |
| ------------------------------------ | ------------------------------------------------------------- |
| Dedicated `cloudcart` namespace      | Group application resources                                   |
| Deployments for frontend and backend | Manage replicas and application updates                       |
| StatefulSet for PostgreSQL           | Demonstrate stateful workload management                      |
| ClusterIP Services                   | Provide stable internal endpoints                             |
| Ingress routing                      | Route HTTP requests by path                                   |
| NetworkPolicies                      | Restrict unnecessary workload communication                   |
| PersistentVolumeClaim                | Preserve database files beyond Pod replacement                |
| ConfigMaps and Secrets               | Separate configuration from application images                |
| ServiceAccount and RBAC              | Demonstrate workload identity and least privilege             |
| SecurityContext                      | Reduce container privileges                                   |
| Health probes                        | Improve traffic and restart decisions                         |
| Resource requests and limits         | Support scheduling and workload containment                   |
| Local kind cluster                   | Enable repeatable hands-on learning without a managed cluster |

---

## 12. Production Architecture Direction

The local Kubernetes deployment provides the foundation for a future cloud deployment.

```text
                       Internet
                           |
                           v
                       Route 53
                           |
                           v
                 AWS Load Balancer
                           |
                           v
                     Amazon EKS
                           |
                    Ingress / Gateway
                           |
                  +--------+--------+
                  |                 |
                  v                 v
               Frontend          Backend
                Pods              Pods
                                    |
                                    v
                             Amazon RDS
                              PostgreSQL
```

A production design would additionally consider multi-AZ placement, private networking, IAM, managed secret storage, backup and recovery, monitoring, logging, capacity planning, and secure deployment automation.

The exact architecture would depend on availability requirements, cost, traffic, security constraints, and operational responsibilities.

---

## 13. Further Development

CloudCart will continue to evolve as a Cloud / DevOps / DevSecOps portfolio project.

Further development areas include:

* AWS infrastructure and managed Kubernetes.
* Infrastructure as Code using Terraform.
* CI/CD with GitHub Actions.
* GitOps-based deployment.
* Image and dependency scanning.
* Secret management and workload identity.
* Policy enforcement and supply-chain security.
* Production observability and operational reliability.

The goal is to demonstrate not only how an application is deployed, but how its infrastructure is designed, secured, maintained, and operated.

---

## Summary

CloudCart Lite demonstrates a practical Kubernetes deployment of a three-tier application.

The project covers workload management, Services, Ingress, DNS, storage, configuration, security, resource controls, health probes, and troubleshooting in a local kind cluster.

The emphasis is on understanding Kubernetes behavior and making engineering decisions that translate into real Cloud / DevOps / DevSecOps work.

