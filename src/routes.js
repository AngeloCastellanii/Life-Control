const routes = [
   { path: '/',        component: 'AppShell', metadata: { title: 'Home' } },
   { path: '/about',   component: 'AppShell', metadata: { title: 'About' } },
   { path: '/domains', component: 'AppShell', metadata: { title: 'Dominios' } },
   { path: '/404',     component: 'NotFound', metadata: { title: 'Not Found' } }
];

export default routes;
