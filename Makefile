

# 
# make dev                → 启动开发模式
# 

# 
.PHONY: dev-seed screenshot auto-serve dev build-cli update-version

_VERSION := $(word 2,$(MAKECMDGOALS))

# 

dev:
	node scripts/kill-dev-electron.mjs
	bash env/task/init-osx.sh 2>&1 | tail -5
	npm run dev

build:
	bash env/task/init-osx.sh 2>&1 | tail -5
	npm run build

# 

update-version:
	@V="$(or $(_VERSION),$(VERSION))"; \
	if [ -z "$$V" ]; then \
		echo "ERROR: 用法：make update-version 2.3.0"; \
		exit 1; \
	fi; \
	node scripts/update-version.mjs "$$V"

# 
