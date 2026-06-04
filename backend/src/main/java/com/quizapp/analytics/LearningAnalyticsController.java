package com.quizapp.analytics;

import com.quizapp.user.CurrentUserService;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/analytics")
public class LearningAnalyticsController {
    private final CurrentUserService currentUsers;
    private final LearningAnalyticsService analytics;

    public LearningAnalyticsController(
            CurrentUserService currentUsers,
            LearningAnalyticsService analytics
    ) {
        this.currentUsers = currentUsers;
        this.analytics = analytics;
    }

    @GetMapping("/overview")
    AnalyticsOverviewDto overview(@AuthenticationPrincipal OAuth2User principal) {
        return analytics.overview(currentUsers.requireUser(principal));
    }

    @GetMapping("/accuracy-trend")
    List<AccuracyTrendDto> accuracyTrend(@AuthenticationPrincipal OAuth2User principal) {
        return analytics.accuracyTrend(currentUsers.requireUser(principal));
    }

    @GetMapping("/weak-words")
    List<WeakWordDto> weakWords(@AuthenticationPrincipal OAuth2User principal) {
        return analytics.weakWords(currentUsers.requireUser(principal));
    }

    @GetMapping("/review-pressure")
    ReviewPressureDto reviewPressure(@AuthenticationPrincipal OAuth2User principal) {
        return analytics.reviewPressure(currentUsers.requireUser(principal));
    }

    @GetMapping("/tag-performance")
    TagPerformanceDto tagPerformance(@AuthenticationPrincipal OAuth2User principal) {
        return analytics.tagPerformance(currentUsers.requireUser(principal));
    }
}
