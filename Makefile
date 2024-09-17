

build_and_install:
	npm run build;
	rm -rfv /Applications/LinkAndroid.app;
	cp -a ./dist-release/mac-arm64/LinkAndroid.app /Applications
