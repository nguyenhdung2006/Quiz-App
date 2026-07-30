package com.quizapp.config;

import jakarta.annotation.PostConstruct;
import java.util.Arrays;
import java.util.Locale;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
public class ProductionDatabaseSafetyGuard {
    private final Environment environment;

    public ProductionDatabaseSafetyGuard(Environment environment) {
        this.environment = environment;
    }

    @PostConstruct
    void validateProductionDatabaseConfiguration() {
        if (!isProductionProfileActive()) {
            return;
        }

        requireExact("spring.jpa.hibernate.ddl-auto", "validate");
        requireBoolean("spring.flyway.enabled", true);
        requireBoolean("spring.flyway.validate-on-migrate", true);
        requireBoolean("spring.flyway.clean-disabled", true);
        requireBoolean("spring.flyway.baseline-on-migrate", false);
    }

    private boolean isProductionProfileActive() {
        return Arrays.stream(environment.getActiveProfiles())
                .filter(profile -> profile != null && !profile.isBlank())
                .map(profile -> profile.trim().toLowerCase(Locale.ROOT))
                .anyMatch(profile -> profile.equals("prod") || profile.equals("production"));
    }

    private void requireExact(String propertyName, String expectedValue) {
        String actualValue = environment.getProperty(propertyName, "");
        if (!expectedValue.equals(actualValue.trim().toLowerCase(Locale.ROOT))) {
            throw unsafe(propertyName, actualValue, expectedValue);
        }
    }

    private void requireBoolean(String propertyName, boolean expectedValue) {
        String actualValue = environment.getProperty(propertyName, "");
        if (!Boolean.toString(expectedValue).equals(actualValue.trim().toLowerCase(Locale.ROOT))) {
            throw unsafe(propertyName, actualValue, Boolean.toString(expectedValue));
        }
    }

    private IllegalStateException unsafe(String propertyName, String actualValue, String expectedValue) {
        return new IllegalStateException(
                "Unsafe production database configuration: " + propertyName
                        + " must be " + expectedValue
                        + " when the prod/production profile is active, but was "
                        + printable(actualValue)
        );
    }

    private String printable(String value) {
        return value == null || value.isBlank() ? "<unset>" : value;
    }
}
