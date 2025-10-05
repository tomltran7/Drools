This project now includes an automated step to build a Vite React frontend and include it in the Spring Boot JAR's static resources.

Assumptions
- The React project is located at sibling folder `../Infinity-React-UI-main` relative to this Maven project root.
- The React project uses Vite and produces a `dist/` directory when `npm run build` is executed.
- Node 18+ and npm are compatible with the configured versions in the pom's frontend-maven-plugin. The plugin will install a local node/npm for the build.

How it works
1. `frontend-maven-plugin` will install Node/npm, run `npm install` and `npm run build` in the React project.
2. `maven-resources-plugin` copies the produced `dist/` directory into `target/classes/static` (so Spring Boot serves it from `/`).

Build and run
From this Maven project root run:

```bash
mvn clean package
# or to run directly (builds frontend first):
mvn -DskipTests spring-boot:run
```

If your React project is in a different path, update the `workingDirectory` and `copy-resources` directory in `pom.xml` to the correct location.

Troubleshooting
- If the frontend build fails, run the build manually in the React project to see the errors:

```bash
cd ../Infinity-React-UI-main
npm install
npm run build
```

- If Node versions are incompatible, update the `nodeVersion` and `npmVersion` in `pom.xml`.
- If you prefer not to use the plugin, build the React project separately and copy `dist/` to `src/main/resources/static`.