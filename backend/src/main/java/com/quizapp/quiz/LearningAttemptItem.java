package com.quizapp.quiz;

import com.quizapp.vocab.VocabularyWord;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

@Entity
@Table(
        name = "learning_attempt_item",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "ux_learning_attempt_item_ordinal",
                        columnNames = {"attempt_id", "ordinal"}
                ),
                @UniqueConstraint(
                        name = "ux_learning_attempt_item_word",
                        columnNames = {"attempt_id", "word_id"}
                )
        }
)
public class LearningAttemptItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "attempt_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private LearningAttempt attempt;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "word_id")
    private VocabularyWord word;

    @Column(name = "word_user_id")
    private Long wordUserId;

    @Column(nullable = false)
    private Integer ordinal;

    @Column(name = "question_mode", nullable = false, length = 20)
    private String questionMode;

    @Column(nullable = false, length = 255)
    private String prompt;

    @Column(name = "correct_answer", nullable = false, length = 255)
    private String correctAnswer;

    public Long getId() { return id; }
    public LearningAttempt getAttempt() { return attempt; }
    public void setAttempt(LearningAttempt attempt) { this.attempt = attempt; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public VocabularyWord getWord() { return word; }
    public void setWord(VocabularyWord word) { this.word = word; }
    public Long getWordUserId() { return wordUserId; }
    public void setWordUserId(Long wordUserId) { this.wordUserId = wordUserId; }
    public int getOrdinal() { return ordinal == null ? 0 : ordinal; }
    public void setOrdinal(int ordinal) { this.ordinal = ordinal; }
    public String getQuestionMode() { return questionMode; }
    public void setQuestionMode(String questionMode) { this.questionMode = questionMode; }
    public String getPrompt() { return prompt; }
    public void setPrompt(String prompt) { this.prompt = prompt; }
    public String getCorrectAnswer() { return correctAnswer; }
    public void setCorrectAnswer(String correctAnswer) { this.correctAnswer = correctAnswer; }
}
