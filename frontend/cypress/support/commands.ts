/// <reference types="cypress" />

// Custom commands for the workflow platform

Cypress.Commands.add('login', (email: string, password: string) => {
  cy.visit('/login');
  cy.get('input[formcontrolname="email"]').clear().type(email);
  cy.get('input[formcontrolname="password"]').clear().type(password);
  cy.get('button[type="submit"]').click();
  cy.url().should('include', '/dashboard');
});

Cypress.Commands.add('loginAsAdmin', () => {
  cy.login('admin@example.com', 'admin123');
});

Cypress.Commands.add('loginAsManager', () => {
  cy.login('alice@example.com', 'demo123');
});

Cypress.Commands.add('loginAsWorker', () => {
  cy.login('bob@example.com', 'demo123');
});

Cypress.Commands.add('logout', () => {
  cy.get('mat-toolbar').find('button').last().click();
  cy.contains('Sign Out').click();
  cy.url().should('include', '/login');
});

declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<void>;
      loginAsAdmin(): Chainable<void>;
      loginAsManager(): Chainable<void>;
      loginAsWorker(): Chainable<void>;
      logout(): Chainable<void>;
    }
  }
}
