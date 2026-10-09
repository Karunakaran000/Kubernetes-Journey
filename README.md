# CloudCart Lite — Kubernetes Journey

A hands-on Kubernetes learning project focused on deploying, operating, troubleshooting, and securing a three-tier application from a Cloud / DevOps / DevSecOps engineering perspective.

CloudCart Lite is a lightweight e-commerce application used to explore Kubernetes architecture, workloads, networking, storage, configuration, and security through practical experiments and real troubleshooting scenarios.

## Project Overview

**Project:** CloudCart Lite — Kubernetes Journey
**Environment:** Local Kubernetes cluster using kind
**Application:** React frontend, Java Spring Boot backend, PostgreSQL database
**Focus:** Kubernetes operations, reliability, troubleshooting, and security

The purpose of this repository is not just to deploy an application. It is to understand what Kubernetes resources do, why they are needed, what can fail, how to diagnose failures, and how these lessons apply to production cloud environments.

## Architecture

```text
                        User / Browser
                              |
                              v
                    Port-forward / Ingress
                              |
                              v
                     Frontend Service
                              |
                              v
                    Frontend Pods (NGINX)
                              |
                       /api requests
                              |
                              v
                     Backend Service
                              |
                              v
                  Backend Pods (Spring Boot)
                              |
                              v
                    PostgreSQL Service
                              |
                              v
                    PostgreSQL StatefulSet
                              |
                              v
                      Persistent Storage
```

The application runs in a dedicated Kubernetes namespace named `cloudcart`.

Supporting Kubernetes resources provide service discovery, configuration, access control, network restrictions, health checks, and persistent storage.

> **Environment note:** This is a local learning environment using a single-node kind cluster. It is not a production high-availability deployment. A local cluster is useful for learning Kubernetes behavior, but it does not provide the failure isolation of a properly designed multi-node production environment.

## Technology Stack

| Component        | Technology                                                  |
| ---------------- | ----------------------------------------------------------- |
| Frontend         | React and NGINX                                             |
| Backend          | Java 21 and Spring Boot                                     |
| Database         | PostgreSQL 17                                               |
| Containers       | Docker                                                      |
| Kubernetes       | kind and kubectl                                            |
| Networking       | Services, DNS, Ingress, NetworkPolicies                     |
| Storage          | PersistentVolumeClaims and persistent volumes               |
| Security         | ConfigMaps, Secrets, ServiceAccounts, RBAC, SecurityContext |
| Future direction | AWS, CI/CD, GitOps, DevSecOps                               |

Application images used in the lab:

* Frontend: `karunakaran07/cloudcart-frontend:1.4`
* Backend: `karunakaran07/cloudcart-backend:1.3`

## What This Project Demonstrates

### Kubernetes workloads and operations

* Namespaces for resource isolation.
* Pods, Deployments, and ReplicaSets.
* Rolling updates and rollbacks.
* Startup, readiness, and liveness probes.
* Resource requests and limits.
* Jobs, CronJobs, DaemonSets, and StatefulSets.
* Understanding declarative configuration and reconciliation.

### Networking and service discovery

* ClusterIP, NodePort, and LoadBalancer Service concepts.
* Kubernetes DNS and Service discovery.
* Ingress routing.
* NetworkPolicies and controlled application traffic.
* Service selectors, endpoints, and EndpointSlices.
* Troubleshooting application connectivity.

### Storage and configuration

* PersistentVolumes and PersistentVolumeClaims.
* StorageClasses and dynamic provisioning.
* StatefulSet volume claim templates.
* ConfigMaps and Secrets.
* Understanding the difference between container filesystems and persistent storage.

### Security

* ServiceAccounts and RBAC.
* Least-privilege access.
* Container SecurityContext.
* Non-root container execution.
* Privilege escalation restrictions and Linux capability dropping.
* Network traffic restrictions.
* Safe handling of sensitive configuration.

### Troubleshooting

The documentation records practical failure scenarios and their root causes, including:

* Frontend startup failures caused by an incorrect backend Service hostname.
* Services with missing endpoints.
* NetworkPolicies blocking required traffic.
* Incorrect ports during connectivity tests.
* Local kind networking and browser access.
* Persistent PostgreSQL data across Pod replacement.
* ConfigMap environment-variable behavior.
* Non-root container configuration failures.
* RBAC permission checks and immutable Pod fields.

See the [Troubleshooting Guide](docs/troubleshooting/troubleshooting.md) for the investigation steps, fixes, and lessons.

## Repository Structure

The repository is organized to separate Kubernetes manifests from the learning documentation.

```text
Kubernetes-Journey/
├── README.md
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
│       └── security/
└── docs/
    ├── architecture/
    │   └── architecture.md
    ├── kubernetes/
    │   └── kubernetes.md
    ├── troubleshooting/
    │   └── troubleshooting.md
    └── security/
        └── security.md
```

The tree describes the intended repository organization. Ensure the actual manifest files are copied into these directories before running the deployment commands.

## Documentation

Read the guides in this order:

1. [Architecture](docs/architecture/architecture.md) — Understand the components, request flow, and design decisions.
2. [Kubernetes Guide](docs/kubernetes/kubernetes.md) — Learn the Kubernetes resources and deployment workflow.
3. [Troubleshooting Guide](docs/troubleshooting/troubleshooting.md) — Investigate practical failures and verify fixes.
4. [Security Guide](docs/security/security.md) — Understand configuration security, RBAC, network restrictions, and container hardening.

## Prerequisites

Before deploying CloudCart Lite, install and verify:

* Docker Desktop with WSL2 integration.
* Ubuntu on WSL2.
* `kubectl`.
* `kind`.
* Access to the CloudCart container images, or the ability to build them locally.

Check your tools:

```bash
docker --version
kubectl version --client
kind version
kubectl config current-context
```

The commands below assume the existing cluster context is `kind-k8s-journey`. If you use a different cluster, select the appropriate context.

## Deploy CloudCart Lite

Run the following commands from the root of this repository.

### 1. Select the Kubernetes context

```bash
kubectl config use-context kind-k8s-journey
kubectl get nodes
```

Confirm that the expected cluster is available before applying any resources.

### 2. Create the namespace

```bash
kubectl apply -f cloudcart/k8s/namespace.yaml
```

### 3. Deploy PostgreSQL

```bash
kubectl apply -f cloudcart/k8s/postgres/
```

This directory should contain the required PostgreSQL resources, including the Service, StatefulSet, Secret, and PersistentVolumeClaim manifests.

Verify the database workload and storage:

```bash
kubectl get pods,pvc,services -n cloudcart
```

### 4. Deploy the backend and frontend

```bash
kubectl apply -f cloudcart/k8s/backend/
kubectl apply -f cloudcart/k8s/frontend/
```

Check workload status:

```bash
kubectl get deployments,pods,services -n cloudcart
```

Wait for the application Pods to become ready. If a Pod fails, inspect its Events and logs before proceeding.

### 5. Configure networking

Apply the Ingress manifest:

```bash
kubectl apply -f cloudcart/k8s/networking/ingress.yaml
```

Apply NetworkPolicies after the relevant workloads and Services exist:

```bash
kubectl apply -f cloudcart/k8s/networking/networkpolicies.yaml
```

Verify:

```bash
kubectl get ingress,networkpolicies -n cloudcart
kubectl get services,endpointslices -n cloudcart
```

**Important:** Security and networking manifests depend on correct labels, ports, and Service names. Confirm those values match your actual manifests. If a NetworkPolicy blocks traffic, troubleshoot the allowed flows rather than removing the policy without investigation.

Security demonstration manifests should be applied individually when following the security guide. Do not assume every demonstration manifest should be deployed alongside the main application.

## Access CloudCart in Your Browser

The simplest way to access the frontend locally is Kubernetes port-forwarding.

### 1. Start port-forwarding

From the repository root, run:

```bash
kubectl port-forward -n cloudcart service/frontend-service 8080:80
```

Keep this terminal open while using the application.

### 2. Open the application

Navigate to:

**http://localhost:8080**

You should see the CloudCart Lite frontend. Application features will work as expected only when the backend, PostgreSQL, and required configuration are healthy.

### 3. Stop port-forwarding

Press `Ctrl+C` in the terminal running the port-forward command.

Port-forwarding is a local access method for development and troubleshooting. It is not a production ingress or public exposure strategy.

## Useful Verification Commands

Inspect the main resources:

```bash
kubectl get all -n cloudcart
kubectl get pvc -n cloudcart
kubectl get ingress -n cloudcart
kubectl get networkpolicies -n cloudcart
```

Inspect a workload:

```bash
kubectl describe deployment <deployment-name> -n cloudcart
kubectl get pods -n cloudcart -o wide
kubectl get events -n cloudcart \
  --sort-by=.metadata.creationTimestamp
```

Read application logs:

```bash
kubectl logs deployment/<deployment-name> -n cloudcart
```

Replace `<deployment-name>` with the actual Deployment name in your manifests.

## Local Lab vs. Production Architecture

The local lab is designed for learning Kubernetes primitives and application operations. Production environments need additional controls and managed services.

| Concern            | Local learning lab               | Possible production direction                                          |
| ------------------ | -------------------------------- | ---------------------------------------------------------------------- |
| Kubernetes         | Single-node kind cluster         | Multi-AZ Amazon EKS                                                    |
| Application access | Port-forward or local Ingress    | Managed load balancer and controlled ingress                           |
| Database           | PostgreSQL in Kubernetes         | Amazon RDS for PostgreSQL where appropriate                            |
| Persistent storage | Local development storage        | Durable managed storage with backup and recovery                       |
| Secrets            | Kubernetes Secret demonstrations | Managed secrets, encryption, and controlled access                     |
| Availability       | Limited by the local cluster     | Multi-AZ architecture, health checks, scaling, and recovery            |
| Delivery           | Manual manifest application      | Automated CI/CD and GitOps workflows                                   |
| Security           | Kubernetes security exercises    | Policy enforcement, image scanning, audit, and continuous verification |

Moving to AWS requires deliberate architecture and operational decisions; it is not simply a matter of changing the Kubernetes context.

## Further Development

The project provides a foundation for expanding into:

* **AWS:** EKS, IAM, VPC networking, load balancing, RDS, and managed secrets.
* **CI/CD:** GitHub Actions, automated testing, image builds, vulnerability scanning, and registry publishing.
* **GitOps:** Declarative deployment management and controlled reconciliation using Argo CD.
* **DevSecOps:** Image security, least privilege, policy enforcement, secrets management, and security checks in delivery pipelines.
* **Operations:** Monitoring, logging, alerting, backups, recovery testing, and incident response.

These directions build on the Kubernetes fundamentals and connect the lab to real cloud engineering workflows.

## Learning Philosophy

This project emphasizes more than successful deployment:

* Understand **what** each Kubernetes resource does.
* Know **why** it exists and when to use it.
* Understand **what can go wrong**.
* Troubleshoot using evidence rather than guesswork.
* Verify that a fix actually works.
* Distinguish a local learning setup from a production architecture.
* Apply security and reliability considerations throughout the lifecycle.

The objective is to build practical Cloud / DevOps / DevSecOps engineering skills that transfer beyond a single application or cluster.

---

**Happy Learning!** 🚀
