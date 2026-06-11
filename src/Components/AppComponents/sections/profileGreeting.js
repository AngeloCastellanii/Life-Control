export function greetingForName(displayName) {
   const hour = new Date().getHours();
   let timeGreeting = 'Buenas noches';

   if (hour >= 5 && hour < 12) {
      timeGreeting = 'Buenos días';
   } else if (hour >= 12 && hour < 19) {
      timeGreeting = 'Buenas tardes';
   }

   const name = displayName?.trim();
   if (!name) {
      return 'Bienvenido';
   }

   return `${timeGreeting}, ${name}`;
}
