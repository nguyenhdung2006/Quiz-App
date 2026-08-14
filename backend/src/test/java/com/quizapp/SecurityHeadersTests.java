package com.quizapp;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {
        "GOOGLE_CLIENT_ID=test-client-id",
        "GOOGLE_CLIENT_SECRET=test-client-secret"
})
@AutoConfigureMockMvc
class SecurityHeadersTests {
    private static final String CSP = "Content-Security-Policy";
    private static final String CSP_REPORT_ONLY = "Content-Security-Policy-Report-Only";
    private static final String HSTS = "Strict-Transport-Security";

    @Autowired
    private MockMvc mockMvc;

    @Test
    void apiResponsesIncludeExplicitSecurityHeaders() throws Exception {
        mockMvc.perform(get("/api/me"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("X-Frame-Options", "DENY"))
                .andExpect(header().string("Referrer-Policy", "strict-origin-when-cross-origin"))
                .andExpect(header().string(CSP, containsString("default-src 'self'")))
                .andExpect(header().string(CSP, containsString("object-src 'none'")))
                .andExpect(header().string(CSP, containsString("frame-ancestors 'none'")))
                .andExpect(header().string(CSP, containsString("script-src 'self'")))
                .andExpect(header().string(CSP, not(containsString("script-src 'self' 'unsafe-inline'"))))
                .andExpect(header().string(CSP, containsString("style-src 'self' 'unsafe-inline'")))
                .andExpect(header().string(CSP, containsString("img-src 'self' data: https:")))
                .andExpect(header().string(CSP, containsString("connect-src 'self' http://localhost:8080 http://127.0.0.1:8080 https://quiz-app-xd9m.onrender.com")))
                .andExpect(header().string(CSP, not(containsString("unsafe-eval"))))
                .andExpect(header().string(CSP_REPORT_ONLY, containsString("script-src 'self'")))
                .andExpect(header().string(CSP_REPORT_ONLY, containsString("style-src 'self'")))
                .andExpect(header().string(CSP_REPORT_ONLY, not(containsString("unsafe-inline"))))
                .andExpect(header().doesNotExist(HSTS));
    }

}
