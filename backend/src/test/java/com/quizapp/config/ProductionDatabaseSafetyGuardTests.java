package com.quizapp.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Matcher;
import java.util.Properties;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.core.io.FileSystemResource;
import org.springframework.mock.env.MockEnvironment;

class ProductionDatabaseSafetyGuardTests {
    private static final Path PROD_PROFILE = Path.of("src", "main", "resources", "application-prod.yml");
    private static final Path MIGRATIONS = Path.of("src", "main", "resources", "db", "migration");
    private static final Pattern MIGRATION_FILE = Pattern.compile("V(\\d+)__[a-z0-9_]+\\.sql");

    @Test
    void productionProfilePinsMigrationSafeValues() {
        Properties properties = loadProdProperties();

        assertThat(valueOf(properties, "spring.jpa.hibernate.ddl-auto")).isEqualTo("validate");
        assertThat(valueOf(properties, "spring.flyway.enabled")).isEqualTo("true");
        assertThat(valueOf(properties, "spring.flyway.validate-on-migrate")).isEqualTo("true");
        assertThat(valueOf(properties, "spring.flyway.clean-disabled")).isEqualTo("true");
        assertThat(valueOf(properties, "spring.flyway.baseline-on-migrate")).isEqualTo("false");
    }

    @Test
    void productionGuardAcceptsSafeEffectiveConfiguration() {
        MockEnvironment environment = safeProductionEnvironment();

        assertThatCode(() -> new ProductionDatabaseSafetyGuard(environment)
                .validateProductionDatabaseConfiguration())
                .doesNotThrowAnyException();
    }

    @Test
    void productionGuardRejectsHibernateSchemaMutation() {
        MockEnvironment environment = safeProductionEnvironment()
                .withProperty("spring.jpa.hibernate.ddl-auto", "update");

        assertThatThrownBy(() -> new ProductionDatabaseSafetyGuard(environment)
                .validateProductionDatabaseConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("spring.jpa.hibernate.ddl-auto must be validate");
    }

    @Test
    void productionGuardRejectsDisabledFlyway() {
        MockEnvironment environment = safeProductionEnvironment()
                .withProperty("spring.flyway.enabled", "false");

        assertThatThrownBy(() -> new ProductionDatabaseSafetyGuard(environment)
                .validateProductionDatabaseConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("spring.flyway.enabled must be true");
    }

    @Test
    void productionGuardRejectsBaselineOnMigrateInSteadyState() {
        MockEnvironment environment = safeProductionEnvironment()
                .withProperty("spring.flyway.baseline-on-migrate", "true");

        assertThatThrownBy(() -> new ProductionDatabaseSafetyGuard(environment)
                .validateProductionDatabaseConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("spring.flyway.baseline-on-migrate must be false");
    }

    @Test
    void productionGuardRejectsFlywayCleanEnabled() {
        MockEnvironment environment = safeProductionEnvironment()
                .withProperty("spring.flyway.clean-disabled", "false");

        assertThatThrownBy(() -> new ProductionDatabaseSafetyGuard(environment)
                .validateProductionDatabaseConfiguration())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("spring.flyway.clean-disabled must be true");
    }

    @Test
    void productionGuardDoesNotBlockLocalDefaults() {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("spring.jpa.hibernate.ddl-auto", "update")
                .withProperty("spring.flyway.enabled", "false");

        assertThatCode(() -> new ProductionDatabaseSafetyGuard(environment)
                .validateProductionDatabaseConfiguration())
                .doesNotThrowAnyException();
    }

    @Test
    void migrationFilesAreVersionedOrderedAndNotTombstoneWork() throws Exception {
        List<Path> migrations;
        try (var stream = Files.list(MIGRATIONS)) {
            migrations = stream
                    .filter(path -> Files.isRegularFile(path))
                    .filter(path -> path.getFileName().toString().endsWith(".sql"))
                    .sorted(Comparator.comparing(path -> path.getFileName().toString()))
                    .toList();
        }

        assertThat(migrations).isNotEmpty();

        for (int index = 0; index < migrations.size(); index++) {
            String fileName = migrations.get(index).getFileName().toString();
            assertThat(fileName)
                    .as("migration file name")
                    .matches(MIGRATION_FILE);

            Matcher matcher = MIGRATION_FILE.matcher(fileName);
            assertThat(matcher.matches()).isTrue();
            int version = Integer.parseInt(matcher.group(1));
            assertThat(version)
                    .as("migration versions must be contiguous from V1")
                    .isEqualTo(index + 1);

            String sql = Files.readString(migrations.get(index)).toLowerCase();
            assertThat(sql).doesNotContain("tombstone");
        }
    }

    private Properties loadProdProperties() {
        YamlPropertiesFactoryBean factory = new YamlPropertiesFactoryBean();
        factory.setResources(new FileSystemResource(PROD_PROFILE));
        Properties properties = factory.getObject();
        assertThat(properties).isNotNull();
        return properties;
    }

    private String valueOf(Properties properties, String key) {
        return String.valueOf(properties.get(key));
    }

    private MockEnvironment safeProductionEnvironment() {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("prod");
        return environment
                .withProperty("spring.jpa.hibernate.ddl-auto", "validate")
                .withProperty("spring.flyway.enabled", "true")
                .withProperty("spring.flyway.validate-on-migrate", "true")
                .withProperty("spring.flyway.clean-disabled", "true")
                .withProperty("spring.flyway.baseline-on-migrate", "false");
    }
}
