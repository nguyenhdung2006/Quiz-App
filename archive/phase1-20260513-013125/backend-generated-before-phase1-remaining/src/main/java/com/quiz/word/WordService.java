package com.quiz.word;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.quiz.shared.ApiException;

@Service
public class WordService {
    private final WordRepository repository;

    public WordService(WordRepository repository) {
        this.repository = repository;
    }

    public List<Word> findAll() {
        return repository.findAll();
    }

    public Word create(WordRequest request) {
        String eng = cleanRequired(request.eng());

        if (repository.existsByEngIgnoreCase(eng)) {
            throw new ApiException(HttpStatus.CONFLICT, "English word already exists.");
        }

        Word word = new Word();
        apply(word, request);
        return repository.save(word);
    }

    public Word update(Long id, WordRequest request) {
        Word word = findById(id);
        String nextEng = cleanRequired(request.eng());

        repository.findByEngIgnoreCase(nextEng)
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> {
                    throw new ApiException(HttpStatus.CONFLICT, "English word already exists.");
                });

        apply(word, request);
        return repository.save(word);
    }

    public Word toggleFavorite(Long id) {
        Word word = findById(id);
        word.setFavorite(!word.isFavorite());
        return repository.save(word);
    }

    public void delete(Long id) {
        repository.delete(findById(id));
    }

    private Word findById(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Word not found."));
    }

    private void apply(Word word, WordRequest request) {
        word.setEng(cleanRequired(request.eng()));
        word.setVie(cleanRequired(request.vie()));
        word.setPos(cleanOptional(request.pos(), "n"));
        word.setTag(cleanOptional(request.tag(), ""));
        word.setExample(cleanOptional(request.example(), ""));
        word.setNote(cleanOptional(request.note(), ""));
        word.setFavorite(Boolean.TRUE.equals(request.favorite()));
        word.setMastered(Boolean.TRUE.equals(request.mastered()));
        word.setSeen(nonNegative(request.seen()));
        word.setCorrect(nonNegative(request.correct()));
        word.setWrong(nonNegative(request.wrong()));
        word.setStreak(nonNegative(request.streak()));
        word.setBestStreak(nonNegative(request.bestStreak()));
    }

    private String cleanRequired(String value) {
        String clean = value == null ? "" : value.trim();
        if (clean.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "English and Vietnamese are required.");
        }
        return clean;
    }

    private String cleanOptional(String value, String fallback) {
        String clean = value == null ? "" : value.trim();
        return clean.isEmpty() ? fallback : clean;
    }

    private int nonNegative(Integer value) {
        return Math.max(value == null ? 0 : value, 0);
    }
}
