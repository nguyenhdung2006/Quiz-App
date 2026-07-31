package com.quizapp;

import static org.hamcrest.Matchers.containsString;
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
        "GOOGLE_CLIENT_SECRET=test-client-secret",
        "app.security.hsts.enabled=true"
})
@AutoConfigureMockMvc
class SecurityHeadersHstsTests {
    private static final String HSTS = "Strict-Transport-Security";

    @Autowired
    private MockMvc mockMvc;

    @Test
    void hstsRequiresSecureRequestEvenWhenEnabled() throws Exception {
        mockMvc.perform(get("/api/me"))
                .andExpect(status().isOk())
                .andExpect(header().doesNotExist(HSTS));

        mockMvc.perform(get("/api/me").secure(true))
                .andExpect(status().isOk())
                .andExpect(header().string(
                        HSTS,
                        containsString("max-age=31536000")
                ))
                .andExpect(header().string(
                        HSTS,
                        containsString("includeSubDomains")
                ));
    }
}
