const users = [
    { username: "dung", password: "mph13nhd" },
    { username: "mit", password: "mph13nhd" }
];

const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const remember = document.getElementById("remember");

// Tự động điền nếu có trong LocalStorage
window.addEventListener("load", () => {
    const savedUser = localStorage.getItem("savedUser");
    const savedPass = localStorage.getItem("savedPass");
    if (savedUser) {
        usernameInput.value = savedUser;
        passwordInput.value = savedPass || "";
        remember.checked = true;
    }
});

function login() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
        alert("Vui lòng nhập đầy đủ thông tin");
        return;
    }

    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
        // CẤP VÉ THÔNG HÀNH (Session) - Tắt tab là mất
        sessionStorage.setItem("isAuthorized", "true");

        // Ghi nhớ thông tin (Local) - Để lần sau tự điền
        if (remember.checked) {
            localStorage.setItem("savedUser", username);
            localStorage.setItem("savedPass", password);
        } else {
            localStorage.removeItem("savedUser");
            localStorage.removeItem("savedPass");
        }

        window.location.href = "index.html";
    } else {
        const box = document.querySelector(".login-box");
        box.classList.add("shake");
        setTimeout(() => box.classList.remove("shake"), 300);
        passwordInput.focus();
    }
}

// Gán sự kiện
document.getElementById("loginBtn").addEventListener("click", login);
document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") login();
});

// CHỈ KHAI BÁO CÁI NÀY 1 LẦN DUY NHẤT
const togglePassBtn = document.getElementById("togglePass");
togglePassBtn.addEventListener("click", () => {
    if (passwordInput.type === "password") {
        passwordInput.type = "text";
        togglePassBtn.textContent = "🙈";
    } else {
        passwordInput.type = "password";
        togglePassBtn.textContent = "👁️";
    }
});
// ================= GOD EVOLUTION =================

const container = document.getElementById("butterfly-container");
const uiElements = document.querySelectorAll("input, button, .login-box");

// Sửa 1: Đổi đường dẫn ảnh thành dạng chuẩn cho GitHub Pages và preload ảnh
const framePaths = [
    "./images/frame1.png","./images/frame2.png","./images/frame3.png",
    "./images/frame4.png","./images/frame5.png","./images/frame6.png",
    "./images/frame7.png","./images/frame8.png","./images/frame9.png",
    "./images/frame10.png"
];

// Ép trình duyệt tải trước toàn bộ ảnh vào bộ nhớ tạm (Fix lỗi 429)
framePaths.forEach(path => {
    const img = new Image();
    img.src = path;
});

const butterflies = [];
const COUNT = 10;

// ===== MOUSE =====
let mouse = {x:0,y:0};
let dangerLevel = 0;

window.addEventListener("mousemove", e=>{
    mouse.x=e.clientX;
    mouse.y=e.clientY;
    dangerLevel+=0.02;
});

setInterval(()=>dangerLevel*=0.9,1000);

// ===== NOISE =====
function noise(t){
    return Math.sin(t)*0.5 + Math.sin(t*0.7)*0.3 + Math.sin(t*1.3)*0.2;
}

// ===== CREATE =====
function createButterfly(){

    const el = document.createElement("div");
    el.className="butterfly";

    const shadow = document.createElement("div");
    shadow.className="shadow";

    container.appendChild(shadow);
    container.appendChild(el);

    const genders = ["male","female"];
    const personality = {
        speed:0.6 + Math.random()*1.2,
        curiosity:Math.random()
    };

    const b = {
        el, shadow,
        x:Math.random()*container.clientWidth,
        y:Math.random()*container.clientHeight,
        vx:0, vy:0,
        angle:0,
        frame:Math.random()*framePaths.length,
        noiseT:Math.random()*1000,

        gender:genders[Math.floor(Math.random()*2)],
        personality,

        targetX:0, targetY:0,
        state:"explore",
        stateTime:200
    };

    butterflies.push(b);
}

for(let i=0;i<COUNT;i++) createButterfly();

// ===== LOOP =====

function update(){

    const rect = container.getBoundingClientRect();

    butterflies.forEach(b=>{

        b.noiseT+=0.01;
        b.stateTime--;

        let dx=b.targetX-b.x;
        let dy=b.targetY-b.y;
        let dist=Math.hypot(dx,dy);

        // ===== FLOCK (GIẢM HÚT - TĂNG ĐẨY) =====
        let ax=0, ay=0, cx=0, cy=0, sx=0, sy=0, count=0;

        butterflies.forEach(o=>{
            if(o===b) return;
            let dx=o.x-b.x, dy=o.y-b.y;
            let d=Math.hypot(dx,dy);

            if(d < 100){ 
                ax += o.vx; 
                ay += o.vy;
                cx += o.x; 
                cy += o.y;
                count++;

                if(d < 60){ 
                    sx -= dx * 0.6;
                    sy -= dy * 0.6;
                }
            }
        });

        if(count > 0){
            ax /= count;
            cx = (cx/count - b.x) * 0.005; 
            cy = (cy/count - b.y) * 0.005;

            b.vx += ax*0.02 + cx + sx*0.08; 
            b.vy += ay*0.02 + cy + sy*0.08;
        }
        // ===== AI =====
        if(b.stateTime<=0){
            b.state = Math.random()<0.5 ? "explore" : "wander";
            b.stateTime = 200;
        }

        if(b.state==="explore" && dist<50){
            b.targetX=Math.random()*rect.width;
            b.targetY=Math.random()*rect.height;
        }

        if(b.state==="wander"){
            b.vx+=noise(b.noiseT)*0.3;
            b.vy+=noise(b.noiseT+100)*0.3;
        }

        // ===== MOUSE AVOID =====
        let mdx=b.x-mouse.x;
        let mdy=b.y-mouse.y;
        let md=Math.hypot(mdx,mdy);

        if(md<120){
            let fear=0.3+dangerLevel;
            b.vx+=(mdx/md)*fear;
            b.vy+=(mdy/md)*fear;
        }

        // ===== MOVE =====
        b.vx+=(dx/(dist||1))*0.05*b.personality.speed;
        b.vy+=(dy/(dist||1))*0.05*b.personality.speed;

        b.vx*=0.96;
        b.vy*=0.96;

        let speed=Math.hypot(b.vx,b.vy);
        let max=2*b.personality.speed;

        if(speed>max){
            b.vx=(b.vx/speed)*max;
            b.vy=(b.vy/speed)*max;
        }

        b.x+=b.vx;
        b.y+=b.vy;

        // ===== HARD BOUND (BẤT TỬ & CHỐNG DỒN CỤC) =====
        const m = 50; 
        const W = rect.width;
        const H = rect.height;

        if (b.x < -200 || b.x > W + 200 || b.y < -200 || b.y > H + 200) {
            b.x = Math.random() * W;
            b.y = Math.random() * H;
            b.vx = (Math.random() - 0.5) * 4;
            b.vy = (Math.random() - 0.5) * 4;
        }

        if (b.x < m) { b.vx += 0.4; }
        if (b.x > W - m) { b.vx -= 0.4; }
        if (b.y < m) { b.vy += 0.4; }
        if (b.y > H - m) { b.vy -= 0.4; }

        // ===== ROTATE =====
        let ta=Math.atan2(b.vy,b.vx);
        let diff=ta-b.angle;
        diff=Math.atan2(Math.sin(diff),Math.cos(diff));
        b.angle+=diff*0.08;

        // ===== SCALE + FILTER =====
        let scale=0.6+(b.y/rect.height)*0.6;
        let depth=Math.abs(0.5-(b.y/rect.height));
        let blur=depth*2 + speed*0.3;

        b.el.style.filter = `blur(${blur}px) brightness(${1.05 + scale*0.2}) contrast(1.05) saturate(1.05)`;

        // ===== WING =====
        b.frame+=0.15+speed*0.3;
        let idx=Math.floor(b.frame)%framePaths.length;
        b.el.style.backgroundImage=`url(${framePaths[idx]})`;

        // ===== SHADOW =====
        b.shadow.style.transform = `translate(${b.x}px,${b.y+20}px) scale(${scale*0.8})`;
        b.shadow.style.opacity = 0.2 + scale*0.3;

        // ===== APPLY =====
        b.el.style.transform = `translate(${b.x}px,${b.y}px) rotate(${b.angle*180/Math.PI}deg) scale(${scale})`;
    });

    requestAnimationFrame(update);
}

update();

// ================= WEBGL ENGINE =================


// ===== PARTICLES (PHẤN HOA) =====
const particles = [];

// Sửa 2: Tạo sẵn 80 hạt ở bên ngoài vòng lặp để tránh tràn RAM/CPU (Fix giật lag)
for(let i=0;i<80;i++){
    let dot = document.createElement("div");
    dot.style.position = "fixed";
    dot.style.width = "2px";
    dot.style.height = "2px";
    dot.style.background = "rgba(255,255,200,0.4)";
    dot.style.borderRadius = "50%";
    dot.style.pointerEvents = "none";
    dot.style.zIndex = "0"; 
    document.body.appendChild(dot);

    particles.push({
        x: Math.random() * window.innerWidth,  // Đã sửa ở đây
        y: Math.random() * window.innerHeight,
        vx: (Math.random()-0.5)*0.5,
        vy: (Math.random()-0.5)*0.5,
        life: Math.random()*100,
        el: dot 
    });
}

// ===== SEASON SYSTEM =====
let season = 0; 

setInterval(()=>{
    season = (season+1)%4;
}, 15000);

// ===== DRAW LOOP =====
function renderGL(t){


    // ===== TỐI ƯU PARTICLE =====
    particles.forEach(p=>{
        p.x += p.vx;
        p.y += p.vy;
        p.life--;

        if(season===0) p.vy -= 0.05; 
        if(season===1) p.vx += 0.05;
        if(season===2) p.vy += 0.05;

        if(p.life <= 0){
            p.x = Math.random() * window.innerWidth;  // <-- Đổi thành window.innerWidth
            p.y = Math.random() * window.innerHeight;
            p.life = 100;
        }

        // Chỉ di chuyển vị trí thẻ div đã có sẵn, mượt hơn 100 lần!
        p.el.style.left = p.x + "px";
        p.el.style.top = p.y + "px";
        p.el.style.opacity = p.life / 100; 
    });

    requestAnimationFrame(renderGL);
}
renderGL(0);
