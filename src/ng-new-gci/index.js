"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gciAngularBase = void 0;
const ts = require("typescript");
const core_1 = require("@angular-devkit/core");
const schematics_1 = require("@angular-devkit/schematics");
const ast_utils_1 = require("@schematics/angular/utility/ast-utils");
const dependency_types_enum_1 = require("./models/dependency-types.enum");
const add_to_module_context_1 = require("./util/add-to-module-context");
const change_1 = require("@schematics/angular/utility/change");
const latestVersions = require('./util/latest-versions.json');
const tsconfigFile = require('./util/tsconfig-override.json');
const cypressJsonFile = require('./util/cypress.json');
function gciAngularBase(_options) {
    const { projectName, addRouting, dependencies, pwa } = _options;
    return (tree, _context) => {
        const logger = _context.logger;
        // First we want to merge everything in the /files/ directory into the schematic,
        // to build the folder structure under ./project-name/
        const templateSource = schematics_1.apply(schematics_1.url('./files'), [
            schematics_1.template(Object.assign(Object.assign({}, _options), core_1.strings)),
            schematics_1.forEach((fileEntry) => {
                // We get weird errors if we don't explicitly overwrite, even though we use MergeStrategy.Overwrite
                if (tree.exists(fileEntry.path)) {
                    tree.overwrite(fileEntry.path, fileEntry.content);
                    return null;
                }
                return fileEntry;
            }),
            // Move everything into our base project folder
            schematics_1.move(`./`),
        ]);
        const merged = schematics_1.mergeWith(templateSource, schematics_1.MergeStrategy.Overwrite);
        // Meat and potatoes - this is the rule chain returned by this factory function
        const rule = schematics_1.chain([
            _generateRepo({ projectName, addRouting, dependencies }),
            merged,
            _updatePackageJson({ projectName, dependencies, pwa }, logger, _context),
            _setTreeStructure(_options, _context),
        ]);
        return rule(tree, _context);
    };
}
exports.gciAngularBase = gciAngularBase;
// This is the first rule in our rule chain, its Angular's ng new schematic
function _generateRepo(_options) {
    return schematics_1.externalSchematic('@schematics/angular', 'ng-new', {
        name: _options.projectName,
        directory: _options.projectName,
        routing: _options.addRouting,
        style: 'scss',
        inlineStyle: false,
        inlineTemplate: false,
        version: latestVersions['angular-cli'],
        skipGit: true,
    });
}
// This function handles all dependencies, if the user selected any from the menu
function _updatePackageJson(options, log, _context) {
    const { projectName, dependencies, pwa } = options;
    const path = `${projectName}`;
    const pkgJsonPath = `${path}/package.json`;
    return (tree) => {
        if (!!pwa) {
            dependencies === null || dependencies === void 0 ? void 0 : dependencies.push('pwa');
        }
        if (dependencies && (dependencies === null || dependencies === void 0 ? void 0 : dependencies.length) > 0) {
            dependencies.forEach((name) => {
                addDependencyToPkgJson(tree, dependency_types_enum_1.DependencyNames[name], dependency_types_enum_1.DependencyTypesByName[name], latestVersions[name], pkgJsonPath);
                log.info(`Added ${name} dependency`);
            });
        }
        const sourcePkgJson = tree.read(pkgJsonPath).toString('utf-8');
        const json = JSON.parse(sourcePkgJson);
        // Add a few standard scripts to package.json
        json.scripts = Object.assign(Object.assign({}, json.scripts), { 'build-prod': "node --max_old_space_size=8192 node_modules/@angular/cli/bin/ng build --prod --output-path 'dist/'", build: 'ng build', start: 'ng serve', 'test-headless': 'ng test --watch=false --browsers ChromeHeadlessNoSandbox --code-coverage', test: 'ng test --browsers Chrome' });
        if (dependencies.includes('prettier')) {
            json.scripts = Object.assign(Object.assign({}, json.scripts), { prettier: 'pretty-quick --staged' });
        }
        // Check for husky and prettier and add hooks
        if (dependencies === null || dependencies === void 0 ? void 0 : dependencies.includes('husky')) {
            if (dependencies === null || dependencies === void 0 ? void 0 : dependencies.includes('prettier')) {
                json.husky = {
                    hooks: {
                        'pre-commit': 'npm run prettier',
                        'pre-push': 'npm run test-headless',
                    },
                };
            }
            else {
                json.husky = {
                    hooks: {
                        'pre-push': 'npm run test-headless',
                    },
                };
            }
        }
        // Add some Cypress scripts, IF we chose cypress
        if (dependencies.includes('cypress')) {
            json.scripts = Object.assign(Object.assign({}, json.scripts), { 'cy:open-local': `cypress open /${options.projectName}/cypress/integration/local/**/*.ts`, 'cy:open-remote': `cypress open /${options.projectName}/cypress/integration/remote/**/*.ts`, 'cy:run': 'cypress run' });
        }
        // Write changes to the file and move on
        tree.overwrite(pkgJsonPath, JSON.stringify(json, null, 2));
        return tree;
    };
}
function addDependencyToPkgJson(tree, pkgName, type, version, path) {
    if (tree.exists(path)) {
        const sourcePkgJson = tree.read(path).toString('utf-8');
        const json = JSON.parse(sourcePkgJson);
        if (!json.dependencies) {
            json.dependencies = {};
        }
        if (!json.devDependencies) {
            json.devDependencies = {};
        }
        if (type === 'Default' && !json.dependencies[pkgName]) {
            json.dependencies[pkgName] = version;
        }
        if (type === 'Dev' && !json.dependencies[pkgName]) {
            json.devDependencies[pkgName] = version;
        }
        if (pkgName === '@angular/material') {
            json.dependencies['@types/angular-material'] = 'latest';
            json.dependencies['@angular/cdk'] = 'latest';
        }
        tree.overwrite(path, JSON.stringify(json, null, 2));
    }
    return tree;
}
// Here is where we will start modifying existing files, services, etc
function _setTreeStructure(_options, _context) {
    return (tree) => {
        var _a;
        if (!_options.dependencies.includes('prettier')) {
            // Check to see if we should delete .prettierrc
            if (tree.exists(`./${_options.projectName}/.prettierrc`)) {
                tree.delete(`./${_options.projectName}/.prettierrc`);
            }
        }
        // Find newly created tsconfig.json
        let path = `./${_options.projectName}/tsconfig.json`;
        if (!tree.exists(path)) {
            throw new schematics_1.SchematicsException('Couldnt locate tsconfig.json');
        }
        // Overwrite with our own tsconfig
        tree.overwrite(path, JSON.stringify(tsconfigFile, null, 2));
        // Find newly created angular.json
        path = `./${_options.projectName}/angular.json`;
        // Find which override we need (pwa vs non pwa)
        const angularOverridePath = !!(_options === null || _options === void 0 ? void 0 : _options.pwa)
            ? `./${_options.projectName}/angular-override.pwa.json`
            : `./${_options.projectName}/angular-override.json`;
        if (!tree.exists(path) || !tree.exists(angularOverridePath)) {
            throw new schematics_1.SchematicsException('Couldnt locate angular.json');
        }
        const readJson = tree.read(angularOverridePath).toString('utf-8');
        const angularJson = JSON.parse(readJson);
        tree.overwrite(path, JSON.stringify(angularJson, null, 2));
        // Cleanup
        tree.delete(`./${_options.projectName}/angular-override.pwa.json`);
        tree.delete(`./${_options.projectName}/angular-override.json`);
        // Find newly created index.html
        path = `${_options.projectName}/src/index.html`;
        const indexPath = !!_options.pwa
            ? `./${_options.projectName}/src/index-override.pwa.html`
            : `./${_options.projectName}/src/index-override.html`;
        const updatedIndex = (_a = tree.read(indexPath)) === null || _a === void 0 ? void 0 : _a.toString('utf-8');
        if (!tree.exists(path) || !updatedIndex) {
            throw new schematics_1.SchematicsException('Couldnt locate index.html');
        }
        tree.overwrite(path, updatedIndex);
        tree.delete(`./${_options.projectName}/src/index-override.pwa.html`);
        tree.delete(`./${_options.projectName}/src/index-override.html`);
        if (!(_options === null || _options === void 0 ? void 0 : _options.pwa)) {
            tree.delete(`./${_options.projectName}/ngsw-config.json`);
            tree.delete(`./${_options.projectName}/src/manifest.webmanifest`);
        }
        // Cypress, if installed, create folders for it and remove the protractor stuff
        if (!!_options.dependencies.includes('cypress')) {
            const projectPath = `./${_options.projectName}`;
            const cypressPath = `${projectPath}/cypress`;
            const integrationPath = `${cypressPath}/integration`;
            const fixturesPath = `${cypressPath}/fixtures`;
            const supportPath = `${cypressPath}/support`;
            const integrationLocalPath = `${integrationPath}/local`;
            const integrationRemotePath = `${integrationPath}/remote`;
            const cypressJsonPath = `${projectPath}/cypress.json`;
            const fixtureFilePath = `${fixturesPath}/example.json`;
            const smoketestFileLocalPath = `${integrationLocalPath}/smoketest.ts`;
            const smoketestFileRemotePath = `${integrationRemotePath}/smoketest.ts`;
            const supportFilePath = `${supportPath}/app.po.ts`;
            const files = [
                cypressJsonPath,
                fixtureFilePath,
                smoketestFileLocalPath,
                smoketestFileRemotePath,
                supportFilePath,
            ];
            files.forEach((path) => {
                if (path === cypressJsonPath) {
                    tree.create(core_1.normalize(path), JSON.stringify(cypressJsonFile, null, 2));
                }
                else if (path === fixtureFilePath || path === supportFilePath) {
                    tree.create(core_1.normalize(path), '{}');
                }
                else {
                    tree.create(core_1.normalize(path), '/// <reference types="Cypress" />\n{}');
                }
            });
        }
        tree = _addImport('@angular/common/http', 'HttpClientModule', _options, tree);
        if (_options.dependencies.includes('flexLayout')) {
            tree = _addImport('@angular/flex-layout', 'FlexLayoutModule', _options, tree);
        }
        return tree;
    };
}
function _addImport(importPath, importName, _options, tree) {
    const appModulePath = `/${_options.projectName}/src/app/app.module.ts`;
    const appModuleFile = tree.read(core_1.normalize(appModulePath)).toString('utf-8');
    if (!appModuleFile) {
        throw new schematics_1.SchematicsException('app.module.ts not found');
    }
    const result = new add_to_module_context_1.AddToModuleContext();
    result.source = ts.createSourceFile(appModulePath, appModuleFile, ts.ScriptTarget.Latest, true);
    result.relativePath = importPath;
    result.classifiedName = importName;
    const importsChanges = ast_utils_1.addImportToModule(result.source, appModulePath, result.classifiedName, result.relativePath);
    const importRecorder = tree.beginUpdate(appModulePath);
    for (const change of importsChanges) {
        console.log('CHANGE: ', change);
        if (change instanceof change_1.InsertChange) {
            importRecorder.insertLeft(change.pos, change.toAdd);
        }
    }
    tree.commitUpdate(importRecorder);
    return tree;
}
//# sourceMappingURL=index.js.map