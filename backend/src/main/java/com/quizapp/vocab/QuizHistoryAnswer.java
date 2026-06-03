package com.quizapp.vocab;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "quiz_history_answers")
public class QuizHistoryAnswer {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "quiz_history_id")
    private QuizHistory quizHistory;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "word_id")
    private VocabularyWord word;

    @Column(name = "question_mode", nullable = false)
    private String questionMode;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String prompt;

    @Column(name = "selected_answer", columnDefinition = "TEXT")
    private String selectedAnswer;

    @Column(name = "correct_answer", columnDefinition = "TEXT", nullable = false)
    private String correctAnswer;

    @Column(name = "is_correct", nullable = false)
    private boolean correct;

    @Column(name = "answered_at", nullable = false)
    private Instant answeredAt;

    @PrePersist
    void prePersist() {
        answeredAt = Instant.now();
    }

    public void setQuizHistory(QuizHistory quizHistory) { this.quizHistory = quizHistory; }
    public void setWord(VocabularyWord word) { this.word = word; }
    public void setQuestionMode(String questionMode) { this.questionMode = questionMode; }
    public void setPrompt(String prompt) { this.prompt = prompt; }
    public void setSelectedAnswer(String selectedAnswer) { this.selectedAnswer = selectedAnswer; }
    public void setCorrectAnswer(String correctAnswer) { this.correctAnswer = correctAnswer; }
    public void setCorrect(boolean correct) { this.correct = correct; }
}
