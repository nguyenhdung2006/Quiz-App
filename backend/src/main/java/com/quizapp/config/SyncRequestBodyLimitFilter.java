package com.quizapp.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quizapp.shared.ApiError;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class SyncRequestBodyLimitFilter extends OncePerRequestFilter {
    private static final String SYNC_PATH = "/api/sync";
    private final ObjectMapper objectMapper;
    private final long maxRequestBodyBytes;

    public SyncRequestBodyLimitFilter(
            ObjectMapper objectMapper,
            @Value("${app.sync.max-request-body-bytes:1048576}") long maxRequestBodyBytes
    ) {
        this.objectMapper = objectMapper;
        this.maxRequestBodyBytes = Math.max(1, maxRequestBodyBytes);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !"POST".equalsIgnoreCase(request.getMethod()) || !isSyncPath(request);
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        long contentLength = request.getContentLengthLong();
        if (contentLength > maxRequestBodyBytes) {
            writePayloadTooLarge(response);
            return;
        }

        LimitedBody body = readLimitedBody(request);
        if (body.exceeded()) {
            writePayloadTooLarge(response);
            return;
        }

        filterChain.doFilter(new CachedBodyRequest(request, body.bytes()), response);
    }

    private boolean isSyncPath(HttpServletRequest request) {
        String path = request.getRequestURI();
        String contextPath = request.getContextPath();
        if (contextPath != null && !contextPath.isBlank() && path.startsWith(contextPath)) {
            path = path.substring(contextPath.length());
        }
        return SYNC_PATH.equals(path);
    }

    private LimitedBody readLimitedBody(HttpServletRequest request) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream((int) Math.min(maxRequestBodyBytes, 8192));
        byte[] buffer = new byte[8192];
        long total = 0;
        int read;
        ServletInputStream inputStream = request.getInputStream();
        while ((read = inputStream.read(buffer)) != -1) {
            total += read;
            if (total > maxRequestBodyBytes) {
                return LimitedBody.tooLarge();
            }
            output.write(buffer, 0, read);
        }
        return LimitedBody.accepted(output.toByteArray());
    }

    private void writePayloadTooLarge(HttpServletResponse response) throws IOException {
        response.setStatus(HttpStatus.PAYLOAD_TOO_LARGE.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        objectMapper.writeValue(
                response.getOutputStream(),
                ApiError.of(
                        "Payload too large.",
                        List.of("/api/sync request body exceeds the configured limit of "
                                + maxRequestBodyBytes + " bytes.")
                )
        );
    }

    private record LimitedBody(byte[] bytes, boolean exceeded) {
        static LimitedBody accepted(byte[] bytes) {
            return new LimitedBody(bytes, false);
        }

        static LimitedBody tooLarge() {
            return new LimitedBody(new byte[0], true);
        }
    }

    private static final class CachedBodyRequest extends HttpServletRequestWrapper {
        private final byte[] body;

        private CachedBodyRequest(HttpServletRequest request, byte[] body) {
            super(request);
            this.body = body;
        }

        @Override
        public ServletInputStream getInputStream() {
            return new CachedBodyServletInputStream(body);
        }

        @Override
        public BufferedReader getReader() {
            String encoding = getCharacterEncoding();
            Charset charset = encoding == null ? StandardCharsets.UTF_8 : Charset.forName(encoding);
            return new BufferedReader(new InputStreamReader(getInputStream(), charset));
        }
    }

    private static final class CachedBodyServletInputStream extends ServletInputStream {
        private final ByteArrayInputStream input;

        private CachedBodyServletInputStream(byte[] body) {
            this.input = new ByteArrayInputStream(body);
        }

        @Override
        public boolean isFinished() {
            return input.available() == 0;
        }

        @Override
        public boolean isReady() {
            return true;
        }

        @Override
        public void setReadListener(ReadListener readListener) {
            if (readListener == null) {
                return;
            }
            try {
                readListener.onDataAvailable();
                if (isFinished()) {
                    readListener.onAllDataRead();
                }
            } catch (IOException exception) {
                readListener.onError(exception);
            }
        }

        @Override
        public int read() {
            return input.read();
        }
    }
}
