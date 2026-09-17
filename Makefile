

# 
# make dev                → 启动开发模式
# 

# 
.PHONY: dev-seed screenshot dev build-and-install build-cli update-version

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
	@if [ -z "$(VERSION)" ]; then \
		echo "ERROR: 用法：make update-version VERSION=2.3.0"; \
		exit 1; \
	fi; \
	node scripts/update-version.mjs "$(VERSION)"

# 
