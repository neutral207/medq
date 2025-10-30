export function Login(){
  const el = document.createElement('div');
  el.className = 'card';
  el.innerHTML = `
    <h1>MedQ Login</h1>
    <form>
      <label>Email <input type="email" required></label><br/>
      <label>Password <input type="password" required></label><br/>
      <button type="submit">Sign In</button>
    </form>
  `;
  el.querySelector('form').addEventListener('submit', e=>{
    e.preventDefault();
    location.href='/?page=dashboard';
  });
  return el;
}
