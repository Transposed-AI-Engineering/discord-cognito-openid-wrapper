const openid = require('./openid');
const github = require('./github');
const crypto = require('./crypto');

jest.mock('./github');
jest.mock('./crypto');

const MOCK_TOKEN = 'MOCK_TOKEN';
const MOCK_CODE = 'MOCK_CODE';

describe('openid domain layer', () => {
  describe('userinfo function', () => {
    describe('with a good token', () => {
      describe('with complete user details', () => {
        beforeEach(() => {
          github.getUserDetails.mockImplementation(() =>
            Promise.resolve({
              sub: 'Some sub',
              name: 'some name',
              login: 'username',
              html_url: 'some profile',
              avatar_url: 'picture.jpg',
              blog: 'website',
              updated_at: '2008-01-14T04:33:35Z'
            })
          );
        });
        describe('with a primary email', () => {
          beforeEach(() => {
            github.getUserEmails.mockImplementation(() =>
              Promise.resolve([
                {
                  primary: false,
                  email: 'not-this-email@example.com',
                  verified: false
                },
                { primary: true, email: 'email@example.com', verified: true }
              ])
            );
          });
          it('Returns the aggregated complete object', async () => {
            const response = await openid.getUserInfo(MOCK_TOKEN);
            expect(response).to.deep.equal({
              email: 'email@example.com',
              email_verified: true,
              name: 'some name',
              picture: 'picture.jpg',
              preferred_username: 'username',
              profile: 'some profile',
              sub: 'undefined',
              updated_at: 1200285215,
              website: 'website'
            });
          });
        });
        describe('without a primary email', () => {
          beforeEach(() => {
            github.getUserEmails.mockImplementation(() =>
              Promise.resolve([
                {
                  primary: false,
                  email: 'not-this-email@example.com',
                  verified: false
                },
                { primary: false, email: 'email@example.com', verified: true }
              ])
            );
          });
          it('fails', () =>
            expect(openid.getUserInfo('MOCK_TOKEN')).to.eventually.be.rejected);
        });
      });
    });
    describe('with a bad token', () => {
      beforeEach(() => {
        github.getUserDetails.mockImplementation(() =>
          Promise.reject(new Error('Bad token'))
        );
        github.getUserEmails.mockImplementation(() =>
          Promise.reject(new Error('Bad token'))
        );
      });
      it('fails', () =>
        expect(openid.getUserInfo('bad token')).to.eventually.be.rejected);
    });
  });
  describe('token function', () => {
    describe('with the correct code', () => {
      beforeEach(() => {
        github.getToken.mockImplementation(() =>
          Promise.resolve({
            access_token: 'SOME_TOKEN',
            token_type: 'bearer',
            scope: 'scope1,scope2'
          })
        );
        crypto.makeIdToken.mockImplementation(() => 'ENCODED TOKEN');
      });

      it('returns a token', async () => {
        const token = await openid.getTokens(
          MOCK_CODE,
          'some state',
          'somehost.com'
        );
        expect(token).to.deep.equal({
          access_token: 'SOME_TOKEN',
          id_token: 'ENCODED TOKEN',
          scope: 'openid scope1 scope2',
          token_type: 'bearer'
        });
      });
    });
    describe('with a bad code', () => {
      beforeEach(() => {
        github.getToken.mockImplementation(() =>
          Promise.reject(new Error('Bad code'))
        );
      });
      it('fails', () =>
        expect(openid.getUserInfo('bad token', 'two', 'three')).to.eventually.be
          .rejected);
    });
  });
  describe('jwks', () => {
    it('Returns the right structure', () => {
      const mockKey = { key: 'mock' };
      crypto.getPublicKey.mockImplementation(() => mockKey);
      expect(openid.getJwks()).to.deep.equal({ keys: [mockKey] });
    });
  });
  describe('openid-configuration', () => {
    describe('with a supplied hostname', () => {
      it('returns the correct response', () => {
        expect(openid.getConfigFor('not-a-real-host.com')).to.deep.equal({
          authorization_endpoint: 'https://not-a-real-host.com/authorize',
          claims_supported: [
            'sub',
            'name',
            'preferred_username',
            'profile',
            'picture',
            'website',
            'email',
            'email_verified',
            'updated_at',
            'iss',
            'aud'
          ],
          display_values_supported: ['page', 'popup'],
          id_token_signing_alg_values_supported: ['RS256'],
          issuer: 'https://not-a-real-host.com',
          jwks_uri: 'https://not-a-real-host.com/jwks.json',
          request_object_signing_alg_values_supported: ['none'],
          response_types_supported: [
            'code',
            'code id_token',
            'id_token',
            'token id_token'
          ],
          scopes_supported: ['openid', 'read:user', 'user:email'],
          subject_types_supported: ['public'],
          token_endpoint: 'https://not-a-real-host.com/token',
          token_endpoint_auth_methods_supported: [
            'client_secret_basic',
            'private_key_jwt'
          ],
          token_endpoint_auth_signing_alg_values_supported: ['RS256'],
          userinfo_endpoint: 'https://not-a-real-host.com/userinfo',
          userinfo_signing_alg_values_supported: ['none']
        });
      });
    });
  });
});