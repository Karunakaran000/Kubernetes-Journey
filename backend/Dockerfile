# =========================
# Stage 1: Build application
# =========================
FROM maven:3.9-eclipse-temurin-21 AS build

WORKDIR /build

COPY pom.xml .
COPY src ./src

RUN mvn clean package -DskipTests


# =========================
# Stage 2: Runtime
# =========================
FROM eclipse-temurin:21-jre

WORKDIR /app

# Create a dedicated non-root user
RUN groupadd --system appgroup \
    && useradd --system --gid appgroup appuser

COPY --from=build /build/target/cloudcart-backend-1.0.0.jar app.jar

# Run the application as the non-root user
USER appuser

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]


