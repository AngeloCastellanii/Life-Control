const routes = [
   { path: '/', component: 'AppShell', metadata: { title: 'Dashboard' } },
   { path: '/planner', component: 'AppShell', metadata: { title: 'Planificador' } },
   { path: '/finances', component: 'AppShell', metadata: { title: 'Finanzas' } },
   { path: '/shopping', component: 'AppShell', metadata: { title: 'Compras' } },
   { path: '/notes', component: 'AppShell', metadata: { title: 'Notas' } },
   { path: '/vision', component: 'AppShell', metadata: { title: 'Vision Board' } },
   { path: '/focus', component: 'AppShell', metadata: { title: 'Modo enfoque' } },
   { path: '/stats', component: 'AppShell', metadata: { title: 'Estadísticas' } },
   { path: '/settings', component: 'AppShell', metadata: { title: 'Perfil' } },
   { path: '/404', component: 'NotFound', metadata: { title: 'Not Found' } }
];

export default routes;
