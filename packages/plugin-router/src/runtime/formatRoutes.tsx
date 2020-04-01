import * as React from 'react';
import * as path from 'path';
import { matchPath } from 'react-router-dom';

const { useEffect, useState } = React;

export default function formatRoutes(routes, parentPath) {
  return routes.map((item) => {
    if (item.children) {
      item.children = formatRoutes(item.children, item.path);
    } else if (item.path) {
      const joinPath = path.join(parentPath || '', item.path);
      // react-router: path=/project/ not match /project
      item.path = joinPath === '/' ? '/' : joinPath.replace(/\/$/, '');
      const itemComponent = item.component;
      if (itemComponent) {
        itemComponent.pageConfig = Object.assign({}, itemComponent.pageConfig, { componentName: itemComponent.name });
      }
    }
    return item;
  });
}

export function wrapperPageWithSSR(context, routes) {
  const pageInitialProps = { ...context.pageInitialProps };
  const WrapperPageFn = () => {
    const ServerWrapperedPage = (props) => {
      const MatchedPageComponent = getComponentByPath(routes, context.pathname);
      return <MatchedPageComponent {...props}  {...pageInitialProps}  />;
    };
    return ServerWrapperedPage;
  };
  return WrapperPageFn;
}


export function wrapperPage(PageComponent) {
  const { pageConfig } = PageComponent;
  const { title, scrollToTop } = pageConfig || {};

  const RouterWrapperedPage = (props) => {
    const [data, setData] = useState((window as any).__ICE_PAGE_PROPS__);
    useEffect(() => {
      if (title) {
        document.title = title;
      }

      if (scrollToTop) {
        window.scrollTo(0, 0);
      }

      // When enter the page for the first time, need to use window.__ICE_PAGE_PROPS__ as props
      // And don't need to re-request to switch routes
      // Set the data to null after use, otherwise other pages will use
      if ((window as any).__ICE_PAGE_PROPS__) {
        (window as any).__ICE_PAGE_PROPS__ = null;
      } else if (PageComponent.getInitialProps) {
        // When the server does not return data, the client calls getinitialprops
        (async () => {
          const result = await PageComponent.getInitialProps();
          setData(result);
        })();
      }
    }, []);
    return <PageComponent  {...Object.assign({}, props, data)} />;
  };
  return RouterWrapperedPage;
}

function getComponentByPath(routes, currPath)  {
  function findMatchRoute(routeList) {
    const matchedRoute = routeList.find(route => {
      return matchPath(currPath, route);
    });
    return matchedRoute.children ? findMatchRoute(matchedRoute.children) : matchedRoute;
  }
  const matchedRoute = findMatchRoute(routes);
  return matchedRoute && matchedRoute.component;
}
