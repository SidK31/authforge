const form = document.querySelector('#register-form');
const email = document.querySelector('#email');
const password = document.querySelector('#password');
const preview = document.querySelector('#request-preview');
const status = document.querySelector('#form-status');

function updatePreview() {
  preview.textContent = JSON.stringify(
    {
      email: email.value.trim().toLowerCase(),
      password: password.value ? '********' : '',
    },
    null,
    2,
  );
}

email.addEventListener('input', updatePreview);
password.addEventListener('input', updatePreview);

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const normalizedEmail = email.value.trim().toLowerCase();

  if (!email.validity.valid) {
    status.textContent = 'Enter a valid email address.';
    return;
  }

  if (password.value.length < 12) {
    status.textContent = 'Password must be at least 12 characters.';
    return;
  }

  if (password.value.length > 128) {
    status.textContent = 'Password must be 128 characters or fewer.';
    return;
  }

  status.textContent = `Request looks valid for ${normalizedEmail}. The live API connection will be added next.`;
});

updatePreview();
