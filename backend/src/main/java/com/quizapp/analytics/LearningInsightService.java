package com.quizapp.analytics;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class LearningInsightService {

    public List<LearningInsightDto> generate(
            AnalyticsOverviewDto overview,
            List<AccuracyTrendDto> trend,
            ReviewPressureDto pressure,
            TagPerformanceDto performance
    ) {
        List<LearningInsightDto> insights = new ArrayList<>();

        performance.tags().stream()
                .filter(metric -> metric.reviewCount() >= 3 && metric.accuracy() < 60)
                .min(Comparator.comparingInt(PerformanceMetricDto::accuracy))
                .ifPresent(metric -> insights.add(new LearningInsightDto(
                        "weak-tag",
                        "You are struggling with " + metric.name() + " vocabulary."
                )));

        performance.quizModes().stream()
                .filter(metric -> metric.reviewCount() >= 3 && metric.accuracy() < 65)
                .min(Comparator.comparingInt(PerformanceMetricDto::accuracy))
                .ifPresent(metric -> insights.add(new LearningInsightDto(
                        "weak-mode",
                        "Your " + metric.name() + " accuracy is significantly lower."
                )));

        if (pressure.overdue() > 0) {
            insights.add(new LearningInsightDto(
                    "overdue-review",
                    "You have " + pressure.overdue() + " overdue review words."
            ));
        }

        trendImprovement(trend).ifPresent(delta -> insights.add(new LearningInsightDto(
                "weekly-improvement",
                "Your weekly accuracy improved by " + delta + "%."
        )));

        if (insights.isEmpty()) {
            insights.add(new LearningInsightDto(
                    "steady-progress",
                    overview.totalWords() == 0
                            ? "Add words to unlock learning analytics."
                            : "Your learning data looks steady. Keep reviewing due words."
            ));
        }

        return insights.stream().limit(4).toList();
    }

    private java.util.Optional<Integer> trendImprovement(List<AccuracyTrendDto> trend) {
        if (trend.size() < 2) return java.util.Optional.empty();

        int midpoint = trend.size() / 2;
        double earlier = trend.subList(0, midpoint).stream()
                .mapToInt(AccuracyTrendDto::accuracy)
                .average()
                .orElse(0);
        double recent = trend.subList(midpoint, trend.size()).stream()
                .mapToInt(AccuracyTrendDto::accuracy)
                .average()
                .orElse(0);
        int delta = (int) Math.round(recent - earlier);
        return delta >= 10 ? java.util.Optional.of(delta) : java.util.Optional.empty();
    }
}
