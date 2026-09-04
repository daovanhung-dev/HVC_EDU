# Cách đưa bộ context vào repository HVC_EDU

Giải nén package tại thư mục bất kỳ, sau đó từ package chạy:

```bash
cp AGENTS.md /duong-dan/HVC_EDU/AGENTS.md
mkdir -p /duong-dan/HVC_EDU/docs/agent-context
cp -r docs/agent-context/* /duong-dan/HVC_EDU/docs/agent-context/
```

Hoặc nếu package được giải nén ngay cạnh repo:

```bash
cp HVC_EDU_AI_CONTEXT/AGENTS.md HVC_EDU/AGENTS.md
mkdir -p HVC_EDU/docs/agent-context
cp -r HVC_EDU_AI_CONTEXT/docs/agent-context/* HVC_EDU/docs/agent-context/
```

Sau đó:

```bash
cd HVC_EDU
git add AGENTS.md docs/agent-context
git commit -m "docs: add AI agent project context"
git push origin main
```

Lưu ý: `06_CURRENT_STATE.md` là snapshot động. Khi CI/deploy/HEAD thay đổi đáng kể, Agent nên cập nhật file này.
