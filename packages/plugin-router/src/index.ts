import * as path from 'path';
import * as fse from 'fs-extra';
import { IPlugin } from '@alib/build-scripts';
import { IRouterOptions } from './types';
import walker from './collector/walker';

// compatible with $ice/routes
const TEM_ROUTER_COMPATIBLE = '$ice/routes';
const TEM_ROUTER_SETS = [TEM_ROUTER_COMPATIBLE];

const plugin: IPlugin = ({ context, onGetWebpackConfig, modifyUserConfig, getValue, applyMethod, registerUserConfig }) => {
  const { rootDir, userConfig, command } = context;
  // [enum] js or ts
  const isMpa = userConfig.mpa;
  const projectType = getValue('PROJECT_TYPE');
  // .tmp path
  const iceTempPath = getValue('ICE_TEMP');
  const routersTempPath = path.join(iceTempPath, `routes.${projectType}`);
  const routerOptions = (userConfig.router || {}) as IRouterOptions;
  const { configPath } = routerOptions;
  let routeConfigPath = configPath
    ? path.join(rootDir, configPath)
    : path.join(rootDir, `src/routes.${projectType}`);
  if (isMpa) {
    // if is mpa use empty router file
    fse.writeFileSync(routersTempPath, 'export default [];', 'utf-8');
    routeConfigPath = routersTempPath;
  }
  const hasRouteFile = fse.existsSync(routeConfigPath);

  // copy templates and export react-router-dom/history apis to ice
  const routerTemplatesPath = path.join(__dirname, '../templates');
  const routerTargetPath =  path.join(iceTempPath, 'router');
  fse.ensureDirSync(routerTargetPath);
  fse.copySync(routerTemplatesPath, routerTargetPath);
  applyMethod('addIceExport', { source: './router' });

  // copy types
  fse.copySync(path.join(__dirname, '../src/types/index.ts'), path.join(iceTempPath, 'router/types.ts'));
  applyMethod('addIceTypesExport', { source: './router/types', specifier: '{ IAppRouterProps }', exportName: 'router?: IAppRouterProps' });
  const routeFile = hasRouteFile ? routeConfigPath : routersTempPath;
  // add babel plugins for ice lazy
  modifyUserConfig('babelPlugins', [...(userConfig.babelPlugins as [] || []), [require.resolve('./babelPluginLazy'), { routeFile }]]);
  // modify webpack config
  onGetWebpackConfig((config) => {
    // add alias
    TEM_ROUTER_SETS.forEach(i => {
      config.resolve.alias.set(i, routeFile);
    });
    // alias for runtime/Router
    config.resolve.alias.set('$ice/Router', path.join(__dirname, 'runtime/Router'));

    // alias for runtime/history
    config.resolve.alias.set('$ice/history', path.join(__dirname, '../templates/history'));

    // alias for react-router-dom
    const routerName = 'react-router-dom';
    config.resolve.alias.set(routerName, require.resolve(routerName));

    // config historyApiFallback for router type browser
    config.devServer.set('historyApiFallback', true);
  });

  // register router in build.json
  registerUserConfig({
    name: 'router',
    validation: 'object',
  });

  // do not watch folder pages when route config is exsits
  if (!hasRouteFile) {
    const routerMatch = 'src/pages';
    const pagesDir = path.join(rootDir, routerMatch);
    const walkerOptions = { rootDir, routerOptions, routersTempPath, pagesDir };
    walker(walkerOptions);
    if (command === 'start') {
      // watch folder change when dev
      applyMethod('watchFileChange', routerMatch, () => {
        walker(walkerOptions);
      });
    }
  }
};

export default plugin;
