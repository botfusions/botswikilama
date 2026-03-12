// Lemma Skills - Task-to-Skill Mapping
// Maps task keywords to relevant skills for suggestion system

/**
 * Skill database for task-based suggestions
 * Maps task keywords to relevant skills
 *
 * CATEGORY SYSTEM:
 * ─────────────────────────────────────────────────────────────
 * WEB DEVELOPMENT:
 *   web-frontend    → React, Next.js, Tailwind, HTML/CSS, WebGL
 *   web-backend     → Node.js, NestJS, FastAPI, GraphQL, tRPC
 *   data-storage    → PostgreSQL, MongoDB, Redis, Vector DB
 *   dev-tool        → Testing, CI/CD, Build tools, Git
 *
 * MOBILE DEVELOPMENT:
 *   mobile-frontend → React Native, Flutter, Expo, Swift, Kotlin
 *
 * GAME DEVELOPMENT:
 *   game-frontend   → Three.js, Canvas, WebGL, Sprite rendering
 *   game-backend    → Godot patterns, Game loop, ECS, State machines
 *   game-tool       → AI art generation, Export, Upscaling, BG removal
 *   game-design     → Pixel art, Level design, Character design, Textures
 *
 * CROSS-CUTTING:
 *   app-security    → OAuth, OWASP, Cryptography, Zero Trust
 *   ui-design       → Figma, Accessibility, Animation, Design systems
 *   infra-devops    → Docker, Kubernetes, Cloud, CI/CD pipelines
 *   programming-language → TypeScript, Python, Rust, Go, Java
 * ─────────────────────────────────────────────────────────────
 */
export const TASK_SKILL_MAP = {
  // ═══════════════════════════════════════════════════════════
  // WEB FRONTEND (React, Next.js, Tailwind, etc.)
  // ═══════════════════════════════════════════════════════════
  "web-frontend": [
    { skill: "html", category: "web-frontend", keywords: ["web", "sayfa", "ui", "arayüz", "html"] },
    { skill: "css", category: "web-frontend", keywords: ["stil", "style", "tasarım", "design", "css"] },
    { skill: "javascript", category: "programming-language", keywords: ["js", "web", "frontend"] },
    { skill: "react", category: "web-frontend", keywords: ["component", "jsx", "hook", "state", "react"] },
    { skill: "vue", category: "web-frontend", keywords: ["vue", "component", "template"] },
    { skill: "angular", category: "web-frontend", keywords: ["angular", "component", "service"] },
    { skill: "tailwind", category: "web-frontend", keywords: ["tailwind", "css", "utility"] },
    { skill: "nextjs", category: "web-frontend", keywords: ["next", "nextjs", "ssr", "app router"] },
    { skill: "typescript", category: "programming-language", keywords: ["ts", "tip", "type", "interface"] },
  ],

  // ═══════════════════════════════════════════════════════════
  // WEB BACKEND (Node.js, NestJS, FastAPI, etc.)
  // ═══════════════════════════════════════════════════════════
  "web-backend": [
    { skill: "nodejs", category: "web-backend", keywords: ["node", "server", "api", "express"] },
    { skill: "express", category: "web-backend", keywords: ["express", "router", "middleware"] },
    { skill: "nestjs", category: "web-backend", keywords: ["nestjs", "module", "controller", "service"] },
    { skill: "python", category: "programming-language", keywords: ["py", "django", "flask", "fastapi"] },
    { skill: "fastapi", category: "web-backend", keywords: ["fastapi", "async", "python"] },
    { skill: "django", category: "web-backend", keywords: ["django", "orm", "python"] },
    { skill: "rest", category: "web-backend", keywords: ["api", "rest", "endpoint", "http"] },
    { skill: "graphql", category: "web-backend", keywords: ["graphql", "query", "mutation", "schema"] },
    { skill: "trpc", category: "web-backend", keywords: ["trpc", "typescript", "rpc"] },
  ],

  // ═══════════════════════════════════════════════════════════
  // DATA STORAGE (Databases, Caches, Vector DBs)
  // ═══════════════════════════════════════════════════════════
  "data-storage": [
    { skill: "postgresql", category: "data-storage", keywords: ["postgres", "sql", "relational", "pg"] },
    { skill: "mongodb", category: "data-storage", keywords: ["mongo", "nosql", "document"] },
    { skill: "redis", category: "data-storage", keywords: ["redis", "cache", "key-value"] },
    { skill: "prisma", category: "data-storage", keywords: ["prisma", "orm", "schema"] },
    { skill: "sqlite", category: "data-storage", keywords: ["sqlite", "local", "embedded"] },
    { skill: "supabase", category: "data-storage", keywords: ["supabase", "postgres", "auth", "storage"] },
    { skill: "pinecone", category: "data-storage", keywords: ["pinecone", "vector", "embedding"] },
    { skill: "elasticsearch", category: "data-storage", keywords: ["elastic", "search", "index"] },
  ],

  // ═══════════════════════════════════════════════════════════
  // DEV TOOLS (Testing, Build, Git)
  // ═══════════════════════════════════════════════════════════
  "dev-tool": [
    { skill: "git", category: "dev-tool", keywords: ["git", "commit", "branch", "merge"] },
    { skill: "docker", category: "infra-devops", keywords: ["docker", "container", "image"] },
    { skill: "webpack", category: "dev-tool", keywords: ["webpack", "bundle", "build"] },
    { skill: "vite", category: "dev-tool", keywords: ["vite", "build", "dev", "hmr"] },
    { skill: "jest", category: "dev-tool", keywords: ["jest", "test", "unit", "spec"] },
    { skill: "vitest", category: "dev-tool", keywords: ["vitest", "test", "vite"] },
    { skill: "playwright", category: "dev-tool", keywords: ["playwright", "e2e", "browser", "test"] },
    { skill: "eslint", category: "dev-tool", keywords: ["eslint", "lint", "format"] },
  ],

  // ═══════════════════════════════════════════════════════════
  // MOBILE FRONTEND (React Native, Flutter, etc.)
  // ═══════════════════════════════════════════════════════════
  "mobile-frontend": [
    { skill: "react-native", category: "mobile-frontend", keywords: ["react native", "mobile", "expo", "rn"] },
    { skill: "flutter", category: "mobile-frontend", keywords: ["flutter", "dart", "mobile", "widget"] },
    { skill: "expo", category: "mobile-frontend", keywords: ["expo", "react native", "mobile"] },
    { skill: "swift", category: "mobile-frontend", keywords: ["swift", "ios", "iphone", "swiftui"] },
    { skill: "kotlin", category: "mobile-frontend", keywords: ["kotlin", "android", "jetpack"] },
  ],

  // ═══════════════════════════════════════════════════════════
  // GAME FRONTEND (Three.js, Canvas, WebGL)
  // ═══════════════════════════════════════════════════════════
  "game-frontend": [
    { skill: "threejs", category: "game-frontend", keywords: ["threejs", "three.js", "webgl", "3d"] },
    { skill: "canvas", category: "game-frontend", keywords: ["canvas", "html5", "2d", "drawing"] },
    { skill: "phaser", category: "game-frontend", keywords: ["phaser", "game", "html5", "2d"] },
    { skill: "webgl", category: "game-frontend", keywords: ["webgl", "shader", "gpu", "3d"] },
  ],

  // ═══════════════════════════════════════════════════════════
  // GAME BACKEND (Godot, Game patterns)
  // ═══════════════════════════════════════════════════════════
  "game-backend": [
    { skill: "godot", category: "game-backend", keywords: ["godot", "gdscript", "game engine"] },
    { skill: "game-loop", category: "game-backend", keywords: ["game loop", "update", "render", "fixed timestep"] },
    { skill: "state-machine", category: "game-backend", keywords: ["state", "fsm", "transition"] },
    { skill: "ecs", category: "game-backend", keywords: ["ecs", "entity", "component", "system"] },
    { skill: "object-pooling", category: "game-backend", keywords: ["pool", "reuse", "spawn", "bullet"] },
  ],

  // ═══════════════════════════════════════════════════════════
  // GAME TOOLS (AI art, Export, Processing)
  // ═══════════════════════════════════════════════════════════
  "game-tool": [
    { skill: "ai-art-generation", category: "game-tool", keywords: ["ai art", "stable diffusion", "flux", "dalle"] },
    { skill: "pixel-art", category: "game-design", keywords: ["pixel", "sprite", "8bit", "16bit", "retro"] },
    { skill: "aseprite", category: "game-tool", keywords: ["aseprite", "sprite", "animation"] },
    { skill: "spritesheet", category: "game-tool", keywords: ["spritesheet", "atlas", "texture", "export"] },
    { skill: "background-removal", category: "game-tool", keywords: ["bg remove", "transparent", "cutout"] },
    { skill: "image-upscaling", category: "game-tool", keywords: ["upscale", "esrgan", "hd", "4k"] },
  ],

  // ═══════════════════════════════════════════════════════════
  // GAME DESIGN (Pixel art, Level design, Characters)
  // ═══════════════════════════════════════════════════════════
  "game-design": [
    { skill: "level-design", category: "game-design", keywords: ["level", "map", "blockout", "flow"] },
    { skill: "character-design", category: "game-design", keywords: ["character", "silhouette", "shape language"] },
    { skill: "texture-art", category: "game-design", keywords: ["texture", "pbr", "normal map", "material"] },
    { skill: "animation", category: "game-design", keywords: ["animation", "walk cycle", "frame", "sprite"] },
    { skill: "tileset", category: "game-design", keywords: ["tileset", "tile", "autotile", "seamless"] },
  ],

  // ═══════════════════════════════════════════════════════════
  // APP SECURITY (Auth, OWASP, Cryptography)
  // ═══════════════════════════════════════════════════════════
  "app-security": [
    { skill: "oauth", category: "app-security", keywords: ["oauth", "auth", "login", "token"] },
    { skill: "jwt", category: "app-security", keywords: ["jwt", "token", "authentication"] },
    { skill: "owasp", category: "app-security", keywords: ["owasp", "security", "vulnerability", "xss", "sql injection"] },
    { skill: "cryptography", category: "app-security", keywords: ["crypto", "encrypt", "hash", "ssl", "tls"] },
    { skill: "clerk", category: "app-security", keywords: ["clerk", "auth", "user management"] },
  ],

  // ═══════════════════════════════════════════════════════════
  // UI DESIGN (Figma, Accessibility, Animation)
  // ═══════════════════════════════════════════════════════════
  "ui-design": [
    { skill: "figma", category: "ui-design", keywords: ["figma", "design", "prototype", "ui"] },
    { skill: "accessibility", category: "ui-design", keywords: ["a11y", "accessibility", "wcag", "aria"] },
    { skill: "animation", category: "ui-design", keywords: ["animation", "motion", "framer motion", "css animation"] },
    { skill: "design-system", category: "ui-design", keywords: ["design system", "tokens", "components"] },
  ],

  // ═══════════════════════════════════════════════════════════
  // INFRA & DEVOPS (Docker, K8s, Cloud)
  // ═══════════════════════════════════════════════════════════
  "infra-devops": [
    { skill: "ci-cd", category: "infra-devops", keywords: ["ci", "cd", "pipeline", "github actions"] },
    { skill: "kubernetes", category: "infra-devops", keywords: ["k8s", "kubernetes", "pod", "deployment"] },
    { skill: "aws", category: "infra-devops", keywords: ["aws", "s3", "lambda", "ec2"] },
    { skill: "vercel", category: "infra-devops", keywords: ["vercel", "deploy", "edge", "serverless"] },
    { skill: "terraform", category: "infra-devops", keywords: ["terraform", "iac", "infrastructure"] },
  ],

  // ═══════════════════════════════════════════════════════════
  // PROGRAMMING LANGUAGES
  // ═══════════════════════════════════════════════════════════
  "programming-language": [
    { skill: "typescript", category: "programming-language", keywords: ["typescript", "ts", "type"] },
    { skill: "python", category: "programming-language", keywords: ["python", "py"] },
    { skill: "rust", category: "programming-language", keywords: ["rust", "rustlang"] },
    { skill: "golang", category: "programming-language", keywords: ["go", "golang"] },
    { skill: "java", category: "programming-language", keywords: ["java", "jvm"] },
  ],
};
