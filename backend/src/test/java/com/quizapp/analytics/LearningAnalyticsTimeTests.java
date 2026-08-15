package com.quizapp.analytics;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.quizapp.user.AppUser;
import com.quizapp.vocab.QuizHistory;
import com.quizapp.vocab.QuizHistoryRepository;
import com.quizapp.vocab.VocabularyRepository;
import com.quizapp.vocab.VocabularyWord;
import com.quizapp.vocab.WordStats;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.TimeZone;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class LearningAnalyticsTimeTests {
    private static final Instant DATE_BOUNDARY = Instant.parse("2026-01-02T00:30:00Z");

    @Test
    void defaultsToUtcAndInvalidConfigurationFallsBackToUtc() {
        Clock clock = Clock.fixed(DATE_BOUNDARY, ZoneOffset.UTC);

        assertThat(new AnalyticsTimeProvider(clock, "").zone()).isEqualTo(ZoneOffset.UTC);
        assertThat(new AnalyticsTimeProvider(clock, "UTC").zone()).isEqualTo(ZoneOffset.UTC);
        assertThat(new AnalyticsTimeProvider(clock, "Mars/Olympus").zone()).isEqualTo(ZoneOffset.UTC);
    }

    @Test
    void sameInstantMapsToExpectedCalendarDateAcrossConfiguredZones() {
        Clock clock = Clock.fixed(DATE_BOUNDARY, ZoneOffset.UTC);

        AnalyticsTimeProvider utc = new AnalyticsTimeProvider(clock, "UTC");
        AnalyticsTimeProvider newYork = new AnalyticsTimeProvider(clock, "America/New_York");

        assertThat(utc.today()).isEqualTo(LocalDate.of(2026, 1, 2));
        assertThat(newYork.today()).isEqualTo(LocalDate.of(2026, 1, 1));
    }

    @Test
    void trendAndOverdueBoundaryUseConfiguredZoneInsteadOfSystemDefault() {
        AppUser user = new AppUser();
        Instant historyAt = Instant.parse("2026-01-02T00:15:00Z");
        Instant nextReviewAt = Instant.parse("2026-01-01T23:30:00Z");

        LearningAnalyticsService utc = service(user, historyAt, nextReviewAt, "UTC");
        LearningAnalyticsService newYork = service(user, historyAt, nextReviewAt, "America/New_York");

        assertThat(utc.accuracyTrend(user)).extracting(AccuracyTrendDto::date)
                .containsExactly(LocalDate.of(2026, 1, 2));
        assertThat(newYork.accuracyTrend(user)).extracting(AccuracyTrendDto::date)
                .containsExactly(LocalDate.of(2026, 1, 1));
        assertThat(utc.reviewPressure(user).overdue()).isEqualTo(1);
        assertThat(newYork.reviewPressure(user).overdue()).isZero();
    }

    @Test
    void dstOverlapKeepsBothInstantsInTheSameNewYorkCalendarDay() {
        Clock clock = Clock.fixed(Instant.parse("2026-11-01T07:00:00Z"), ZoneOffset.UTC);
        AnalyticsTimeProvider newYork = new AnalyticsTimeProvider(clock, "America/New_York");

        assertThat(newYork.toDate(Instant.parse("2026-11-01T05:30:00Z")))
                .isEqualTo(LocalDate.of(2026, 11, 1));
        assertThat(newYork.toDate(Instant.parse("2026-11-01T06:30:00Z")))
                .isEqualTo(LocalDate.of(2026, 11, 1));
    }

    @Test
    void utcAnalyticsDoesNotChangeWhenJvmDefaultTimezoneChanges() {
        TimeZone original = TimeZone.getDefault();
        try {
            TimeZone.setDefault(TimeZone.getTimeZone("Asia/Tokyo"));
            LocalDate tokyoHostDate = new AnalyticsTimeProvider(
                    Clock.fixed(DATE_BOUNDARY, ZoneOffset.UTC),
                    "UTC"
            ).today();
            TimeZone.setDefault(TimeZone.getTimeZone("America/Los_Angeles"));
            LocalDate losAngelesHostDate = new AnalyticsTimeProvider(
                    Clock.fixed(DATE_BOUNDARY, ZoneOffset.UTC),
                    "UTC"
            ).today();

            assertThat(tokyoHostDate).isEqualTo(LocalDate.of(2026, 1, 2));
            assertThat(losAngelesHostDate).isEqualTo(tokyoHostDate);
        } finally {
            TimeZone.setDefault(original);
        }
    }

    private LearningAnalyticsService service(
            AppUser user,
            Instant historyAt,
            Instant nextReviewAt,
            String zone
    ) {
        VocabularyRepository words = mock(VocabularyRepository.class);
        QuizHistoryRepository histories = mock(QuizHistoryRepository.class);
        LearningInsightService insights = mock(LearningInsightService.class);

        QuizHistory history = new QuizHistory();
        history.setTotalQuestions(2);
        history.setCorrectAnswers(1);
        ReflectionTestUtils.setField(history, "createdAt", historyAt);

        VocabularyWord word = new VocabularyWord();
        WordStats stats = new WordStats();
        stats.setNextReview(nextReviewAt);
        word.setStats(stats);

        when(histories.findByUserOrderByCreatedAtDesc(user)).thenReturn(List.of(history));
        when(words.findByUserOrderByCreatedAtDesc(user)).thenReturn(List.of(word));

        return new LearningAnalyticsService(
                words,
                histories,
                insights,
                new AnalyticsTimeProvider(Clock.fixed(DATE_BOUNDARY, ZoneOffset.UTC), zone)
        );
    }
}
