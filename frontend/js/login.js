const AUTH_CONFIG = {
    apiOrigin: window.quizApiOrigin ? window.quizApiOrigin() : ""
};

AUTH_CONFIG.googleOAuthStartPath = `${AUTH_CONFIG.apiOrigin}/oauth2/authorization/google`;

const googleLoginBtn = document.getElementById("googleLoginBtn");
const extraLoginCtas = document.querySelectorAll("[data-login-cta]");

async function showCurrentGoogleSession() {
    if (!googleLoginBtn) return;

    try {
        const response = await fetch(`${AUTH_CONFIG.apiOrigin}/api/me`, {
            credentials: "include"
        });
        if (!response.ok) return;

        const profile = await response.json();
        if (!profile?.authenticated) return;

        const label = googleLoginBtn.querySelector("span:last-child");
        const name = profile.name || "Google";
        const email = profile.email ? ` (${profile.email})` : "";
        if (label) label.textContent = `Continue as ${name}${email}`;
    } catch (error) {
        // Login still works; the backend may simply be offline while editing locally.
    }
}

function showOAuthError() {
    const params = new URLSearchParams(window.location.search);
    const isError = params.get("error") === "oauth";
    const isLoggedOut = params.get("loggedOut") === "true";
    if (!isError && !isLoggedOut) return;

    const loginBox = document.querySelector(".login-box");
    const message = document.createElement("p");
    message.className = isError ? "login-status login-status--error" : "login-status";
    if (isError) message.setAttribute("role", "alert");
    message.textContent = isError
        ? "Google sign-in could not be completed. Please try again."
        : "You have been logged out.";
    loginBox?.appendChild(message);
}

function continueWithGoogle() {
    window.location.href = AUTH_CONFIG.googleOAuthStartPath;
}

if (googleLoginBtn) {
    googleLoginBtn.href = AUTH_CONFIG.googleOAuthStartPath;
}

extraLoginCtas.forEach(button => {
    button.href = AUTH_CONFIG.googleOAuthStartPath;
    button.addEventListener("click", continueWithGoogle);
});

googleLoginBtn?.addEventListener("click", continueWithGoogle);

document.addEventListener("keydown", (event) => {
    if (event.key === "Enter") continueWithGoogle();
});

const container = document.getElementById("butterfly-container");
const framePaths = [
    "./images/frame1.png", "./images/frame2.png", "./images/frame3.png",
    "./images/frame4.png", "./images/frame5.png", "./images/frame6.png",
    "./images/frame7.png", "./images/frame8.png", "./images/frame9.png",
    "./images/frame10.png"
];

framePaths.forEach(path => {
    const img = new Image();
    img.src = path;
});

const butterflies = [];
const butterflyCount = window.matchMedia("(max-width: 680px)").matches ? 3 : 5;

function createButterfly() {
    const el = document.createElement("div");
    const shadow = document.createElement("div");
    el.className = "butterfly";
    shadow.className = "shadow";
    container.append(shadow, el);

    butterflies.push({
        el,
        shadow,
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 1.2,
        vy: (Math.random() - 0.5) * 1.2,
        targetX: Math.random() * window.innerWidth,
        targetY: Math.random() * window.innerHeight,
        frame: Math.random() * framePaths.length,
        drift: Math.random() * 1000
    });
}

for (let i = 0; i < butterflyCount; i++) createButterfly();

function resetTarget(b) {
    b.targetX = Math.random() * window.innerWidth;
    b.targetY = Math.random() * window.innerHeight;
}

function animateButterflies() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    butterflies.forEach(b => {
        b.drift += 0.016;

        const dx = b.targetX - b.x;
        const dy = b.targetY - b.y;
        const distance = Math.hypot(dx, dy) || 1;

        if (distance < 70) resetTarget(b);

        b.vx += (dx / distance) * 0.035 + Math.sin(b.drift) * 0.025;
        b.vy += (dy / distance) * 0.035 + Math.cos(b.drift * 0.8) * 0.025;

        b.vx *= 0.965;
        b.vy *= 0.965;

        b.x += b.vx;
        b.y += b.vy;

        if (b.x < -80 || b.x > width + 80 || b.y < -80 || b.y > height + 80) {
            b.x = Math.random() * width;
            b.y = Math.random() * height;
            resetTarget(b);
        }

        const speed = Math.hypot(b.vx, b.vy);
        const angle = Math.atan2(b.vy, b.vx);
        const depth = Math.max(0.65, Math.min(1.25, 0.65 + (b.y / Math.max(height, 1)) * 0.6));

        b.frame += 0.14 + speed * 0.28;
        b.el.style.backgroundImage = `url(${framePaths[Math.floor(b.frame) % framePaths.length]})`;
        b.el.style.transform = `translate3d(${b.x}px, ${b.y}px, 0) rotate(${angle}rad) scale(${depth})`;
        b.shadow.style.transform = `translate3d(${b.x}px, ${b.y + 22}px, 0) scale(${depth * 0.75})`;
        b.shadow.style.opacity = String(0.16 + depth * 0.22);
    });

    if (!document.hidden) requestAnimationFrame(animateButterflies);
}

animateButterflies();

const dust = [];
const dustCount = window.matchMedia("(max-width: 680px)").matches ? 16 : 32;
for (let i = 0; i < dustCount; i++) {
    const dot = document.createElement("div");
    dot.className = "ambient-dot";
    document.body.appendChild(dot);

    dust.push({
        el: dot,
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.28,
        vy: -0.08 - Math.random() * 0.3,
        life: 40 + Math.random() * 80
    });
}

function animateDust() {
    dust.forEach(dot => {
        dot.x += dot.vx;
        dot.y += dot.vy;
        dot.life -= 0.45;

        if (dot.life <= 0 || dot.y < -10) {
            dot.x = Math.random() * window.innerWidth;
            dot.y = window.innerHeight + Math.random() * 80;
            dot.life = 60 + Math.random() * 90;
        }

        dot.el.style.transform = `translate3d(${dot.x}px, ${dot.y}px, 0)`;
        dot.el.style.opacity = String(Math.min(0.75, dot.life / 100));
    });

    if (!document.hidden) requestAnimationFrame(animateDust);
}

document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
        requestAnimationFrame(animateButterflies);
        requestAnimationFrame(animateDust);
    }
});

showOAuthError();
showCurrentGoogleSession();
animateDust();
