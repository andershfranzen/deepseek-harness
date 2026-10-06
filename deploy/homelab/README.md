# Homelab deployment

Keeps the homelab's dsh web UI on the latest `homelab` branch of this fork and the latest `main` of each web plugin in
`dsh-deploy`'s `PLUGINS` list: [dsh-go](https://github.com/andershfranzen/dsh-go) and
[dsh-brand-a5](https://github.com/andershfranzen/dsh-brand-a5). A plugin removed from the list is uninstalled on the next
deploy.

| File | Installed to |
|---|---|
| `dsh-deploy` | `/usr/local/bin/dsh-deploy` |
| `dsh.service`, `dsh-deploy.service`, `dsh-deploy.timer` | `/etc/systemd/system/` |

`dsh-deploy.timer` runs `dsh-deploy` every 5 minutes. A new commit is built in its own worktree under
`~/apps/dsh/releases/<sha>` while dsh keeps running. The switch of `~/apps/dsh/current`, the plugin reinstall, and the
restart wait until no session has written for 10 minutes, so a running agent turn is never cut off. If dsh does not
answer HTTP within 2 minutes, both are rolled back and the commit is skipped until the branch moves on. Builds,
deploys, rollbacks, and failures are reported through `ntfy-send`.

`~/apps/deepseek-harness` and `~/apps/dsh-go` are development checkouts (dsh's own workspaces) and are never touched by
the deployer. To ship a change, commit and push it to `homelab` (harness) or a plugin's `main`. New UI customizations
belong in a plugin repository like these rather than in the harness, so upstream merges stay conflict-free.

```bash
dsh-deploy --status                      # live, pending, and failed commits
sudo systemctl start dsh-deploy          # check now instead of waiting for the timer
dsh-deploy --now                         # deploy without waiting for idle sessions
journalctl -u dsh-deploy -f              # deploy log; build logs: ~/apps/dsh/releases/<sha>.build.log
```

The installed copies are not updated by the deployer itself; after changing these files, copy them again and run
`sudo systemctl daemon-reload`.
