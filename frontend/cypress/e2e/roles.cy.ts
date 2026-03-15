/// <reference types="cypress" />

describe('Role-Based Access', () => {

  it('Admin should see all admin nav sections', () => {
    cy.loginAsAdmin();
    cy.contains('Navigation').should('be.visible');
    cy.contains('Tools').should('be.visible');
    cy.contains('Administration').should('be.visible');
    cy.contains('Users').should('be.visible');
    cy.contains('Teams').should('be.visible');
  });

  it('Admin should access admin users page', () => {
    cy.loginAsAdmin();
    cy.contains('a', 'Users').click();
    cy.url().should('include', '/admin/users');
  });

  it('Admin should access admin teams page', () => {
    cy.loginAsAdmin();
    cy.contains('a', 'Teams').click();
    cy.url().should('include', '/admin/teams');
  });

  it('Manager should see Tools and limited Admin', () => {
    cy.loginAsManager();
    cy.contains('Tools').should('be.visible');
    cy.contains('Workflow Designer').should('be.visible');
    cy.contains('Administration').should('be.visible');
    cy.contains('Teams').should('be.visible');
    // Manager should NOT see Users admin link
    cy.get('mat-sidenav').within(() => {
      cy.contains('a', 'Users').should('not.exist');
    });
  });

  it('Worker should not see Tools or Admin', () => {
    cy.loginAsWorker();
    cy.contains('Tools').should('not.exist');
    cy.contains('Administration').should('not.exist');
  });

  it('Worker can access cases page', () => {
    cy.loginAsWorker();
    cy.contains('a', 'Cases').click();
    cy.url().should('include', '/cases');
    cy.contains('h1', 'Cases').should('be.visible');
  });

  it('Worker can access tasks page', () => {
    cy.loginAsWorker();
    cy.contains('a', 'My Tasks').click();
    cy.url().should('include', '/tasks');
    cy.contains('h1', 'Task Kanban Board').should('be.visible');
  });
});
