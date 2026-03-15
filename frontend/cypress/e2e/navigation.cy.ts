/// <reference types="cypress" />

describe('Shell / Navigation', () => {
  it('should show toolbar with branding', () => {
    cy.loginAsManager();
    cy.get('mat-toolbar').should('be.visible');
    cy.contains('Workflow').should('be.visible');
  });

  it('should show sidebar navigation items', () => {
    cy.loginAsManager();
    cy.contains('Dashboard').should('be.visible');
    cy.contains('Cases').should('be.visible');
    cy.contains('My Tasks').should('be.visible');
    cy.contains('Documents').should('be.visible');
    cy.contains('Approvals').should('be.visible');
  });

  it('should show Tools section for Manager role', () => {
    cy.loginAsManager();
    cy.contains('Tools').should('be.visible');
    cy.contains('Workflow Designer').should('be.visible');
    cy.contains('Form Builder').should('be.visible');
    cy.contains('SLA Dashboard').should('be.visible');
  });

  it('should show Admin sections for Admin role', () => {
    cy.loginAsAdmin();
    cy.contains('Administration').should('be.visible');
    cy.contains('Users').should('be.visible');
    cy.contains('Teams').should('be.visible');
  });

  it('should NOT show Admin section for Worker role', () => {
    cy.loginAsWorker();
    cy.contains('Administration').should('not.exist');
    cy.contains('Tools').should('not.exist');
  });

  it('should navigate to Cases via sidebar', () => {
    cy.loginAsManager();
    cy.contains('a', 'Cases').click();
    cy.url().should('include', '/cases');
  });

  it('should navigate to Tasks via sidebar', () => {
    cy.loginAsManager();
    cy.contains('a', 'My Tasks').click();
    cy.url().should('include', '/tasks');
  });

  it('should show user menu with name and role', () => {
    cy.loginAsManager();
    cy.contains('span', 'Alice Johnson').click();
    cy.contains('MANAGER').should('be.visible');
  });

  it('should logout from user menu', () => {
    cy.loginAsManager();
    cy.contains('span', 'Alice Johnson').click();
    cy.contains('Sign Out').click();
    cy.url().should('include', '/login');
  });
});
