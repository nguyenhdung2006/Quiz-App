package com.quiz.wrongword;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.quiz.shared.ApiException;

@Service
public class WrongWordService {
    private final WrongWordRepository repository;

    public WrongWordService(WrongWordRepository repository) {
        this.repository = repository;
    }

    public List<WrongWord> findAll() {
        return repository.findAll();
    }

    public WrongWord upsert(WrongWordRequest request) {
        WrongWord word = repository.findByEngIgnoreCase(cleanRequired(request.eng()))
                .orElseGet(WrongWord::new);
        apply(word, request);
        return repository.save(word);
    }

    public WrongWord markMastered(Long id, boolean mastered) {
        WrongWord word = findById(id);
        word.setMastered(mastered);
        return repository.save(word);
    }

    public void delete(Long id) {
        repository.delete(findById(id));
    }

    @Transactional
    public long clearMastered() {
        return repository.deleteByMasteredTrue();
    }

    private WrongWord findById(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Wrong word not found."));
    }

    private void apply(WrongWord word, WrongWordRequest request) {
        word.setEng(cleanRequired(request.eng()));
        word.setVie(cleanRequired(request.vie()));
        word.setPos(cleanOptional(request.pos(), "n"));
        word.setTag(cleanOptional(request.tag(), ""));
        word.setExample(cleanOptional(request.example(), ""));
        word.setNote(cleanOptional(request.note(), ""));
        word.setMastered(Boolean.TRUE.equals(request.mastered()));
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
}
