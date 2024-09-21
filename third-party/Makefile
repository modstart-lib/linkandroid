
make_image_beautifier:
	echo "Building image beautifier"
	cd image-beautifier && npm run build
	rm -rfv ../public/third-party/image-beautifier
	mv image-beautifier/dist ../public/third-party/image-beautifier
