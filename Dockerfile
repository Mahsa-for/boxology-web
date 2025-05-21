# Use a lightweight nginx image
FROM nginx:alpine

# Copy all your local files (html, js, images, plugin, library) into nginx's web root folder
COPY . /usr/share/nginx/html

# Expose port 80 (default nginx port)
EXPOSE 80

# Start nginx in the foreground (default command, can be omitted)
CMD ["nginx", "-g", "daemon off;"]
