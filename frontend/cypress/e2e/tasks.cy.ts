/// <reference types="cypress" />

describe('Task Kanban Board', () => {
  beforeEach(() => {
    cy.loginAsManager();
    cy.contains('a', 'My Tasks').click();
    cy.url().should('include', '/tasks');
  });

  it('should display kanban board heading', () => {
    cy.contains('h1', 'Task Kanban Board').should('be.visible');
    cy.contains('Drag tasks to update status').should('be.visible');
  });

  it('should show filter controls', () => {
    cy.contains('mat-label', 'View').should('exist');
    cy.contains('mat-label', 'Filter by Priority').should('exist');
    cy.contains('button', 'Clear Filters').should('be.visible');
  });

  it('should display 5 kanban columns', () => {
    cy.contains('Pending').should('be.visible');
    cy.contains('In Progress').should('be.visible');
    cy.contains('Review').should('be.visible');
    cy.contains('Done').should('be.visible');
    cy.contains('Blocked').should('be.visible');
  });

  it('should display task cards inside columns', () => {
    cy.get('[cdkdrag], .cdk-drag').should('have.length.greaterThan', 0);
  });

  it('should show task card details', () => {
    cy.get('[cdkdrag], .cdk-drag').first().within(() => {
      // Task card should have a title
      cy.get('.font-semibold, .font-bold, h3, h4').should('exist');
    });
  });
});
