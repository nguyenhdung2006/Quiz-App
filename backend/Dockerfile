FROM eclipse-temurin:17-jdk AS build
WORKDIR /app

COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw
RUN ./mvnw -B dependency:go-offline

COPY src/ src/
RUN ./mvnw -B clean package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app

RUN groupadd --system --gid 10001 quizapp \
    && useradd --system --uid 10001 --gid quizapp --home-dir /app --shell /usr/sbin/nologin quizapp

COPY --from=build --chown=quizapp:quizapp /app/target/*.jar app.jar

USER quizapp:quizapp

EXPOSE 8080
CMD ["sh", "-c", "java -Dserver.port=${PORT:-8080} -Dspring.profiles.active=${SPRING_PROFILES_ACTIVE:-prod} -jar app.jar"]
