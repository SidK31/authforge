import { validate } from 'class-validator';
import { AccountTokenDto } from './account-token.dto';
import { TokenPasswordResetDto } from './token-password-reset.dto';

const validToken = 'A'.repeat(43);

describe('account lifecycle token DTOs', () => {
  it('accepts a generated-style opaque token', async () => {
    const dto = new AccountTokenDto();
    dto.token = validToken;

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects oversized or malformed verification tokens', async () => {
    const oversized = new AccountTokenDto();
    oversized.token = 'A'.repeat(129);
    const malformed = new AccountTokenDto();
    malformed.token = `${validToken}!`;

    await expect(validate(oversized)).resolves.not.toHaveLength(0);
    await expect(validate(malformed)).resolves.not.toHaveLength(0);
  });

  it('rejects oversized or malformed password reset tokens', async () => {
    const oversized = new TokenPasswordResetDto();
    oversized.token = 'A'.repeat(129);
    oversized.newPassword = 'new-secure-password-123';
    const malformed = new TokenPasswordResetDto();
    malformed.token = `${validToken}!`;
    malformed.newPassword = 'new-secure-password-123';

    await expect(validate(oversized)).resolves.not.toHaveLength(0);
    await expect(validate(malformed)).resolves.not.toHaveLength(0);
  });
});
