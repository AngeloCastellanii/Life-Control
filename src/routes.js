const routes = [
   { path: '/', component: 'AppShell', metadata: { title: 'Dashboard' } },
   { path: '/planner', component: 'AppShell', metadata: { title: 'Planificador' } },
   { path: '/finances', component: 'AppShell', metadata: { title: 'Finanzas' } },
   { path: '/shopping', component: 'AppShell', metadata: { title: 'Compras' } },
   { path: '/domains', component: 'AppShell', metadata: { title: 'Dominios' } },
   { path: '/settings', component: 'AppShell', metadata: { title: 'Perfil' } },
   { path: '/404', component: 'NotFound', metadata: { title: 'Not Found' } }
];

export default routes;
