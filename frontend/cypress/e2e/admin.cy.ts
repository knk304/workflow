/// <reference types="cypress" />

describe('Admin Settings', () => {

  // ====== USER MANAGEMENT ======
  describe('User Management', () => {
    beforeEach(() => {
      cy.loginAsAdmin();
      cy.contains('a', 'Users').click();
      cy.url().should('include', '/admin/users');
    });

    it('should display user management page with stats', () => {
      cy.contains('h1', 'User Management').should('be.visible');
      cy.contains('Total Users').should('be.visible');
      cy.contains('Admins').should('be.visible');
      cy.contains('Managers').should('be.visible');
    });

    it('should display users table with columns', () => {
      cy.get('[data-cy="users-table"]').should('be.visible');
      cy.contains('th', 'User').should('be.visible');
      cy.contains('th', 'Role').should('be.visible');
      cy.contains('th', 'Teams').should('be.visible');
      cy.contains('th', 'Joined').should('be.visible');
      cy.contains('th', 'Actions').should('be.visible');
    });

    it('should show Add User button', () => {
      cy.get('[data-cy="add-user-btn"]').should('be.visible');
      cy.get('[data-cy="add-user-btn"]').should('contain.text', 'Add User');
    });

    it('should show edit and delete buttons for each user row', () => {
      cy.get('[data-cy="edit-user-btn"]').should('have.length.at.least', 1);
      cy.get('[data-cy="delete-user-btn"]').should('have.length.at.least', 1);
    });

    it('should open add user dialog', () => {
      cy.get('[data-cy="add-user-btn"]').click();
      cy.get('[data-cy="user-dialog"]').should('be.visible');
      cy.contains('Add New User').should('be.visible');
      cy.get('[data-cy="user-name-input"]').should('be.visible');
      cy.get('[data-cy="user-email-input"]').should('be.visible');
      cy.get('[data-cy="user-password-input"]').should('be.visible');
      cy.get('[data-cy="user-role-select"]').should('be.visible');
      cy.get('[data-cy="user-teams-select"]').should('be.visible');
    });

    it('should close add user dialog on cancel', () => {
      cy.get('[data-cy="add-user-btn"]').click();
      cy.get('[data-cy="user-dialog"]').should('be.visible');
      cy.get('[data-cy="user-cancel-btn"]').click();
      cy.get('[data-cy="user-dialog"]').should('not.exist');
    });

    it('should create, edit, and delete a user', () => {
      const uniqueEmail = `cy-test-${Date.now()}@example.com`;
      // CREATE
      cy.get('[data-cy="add-user-btn"]').click();
      cy.get('[data-cy="user-name-input"]').type('Cypress Test User');
      cy.get('[data-cy="user-email-input"]').type(uniqueEmail);
      cy.get('[data-cy="user-password-input"]').type('test123456');
      cy.get('[data-cy="user-role-select"]').click();
      cy.get('mat-option').contains('WORKER').click();
      cy.get('[data-cy="user-save-btn"]').click();
      cy.get('[data-cy="user-dialog"]').should('not.exist');
      cy.get('[data-cy="users-table"]').should('contain.text', 'Cypress Test User');

      // EDIT - change role
      cy.contains('tr', 'Cypress Test User').find('[data-cy="edit-user-btn"]').click();
      cy.get('[data-cy="user-dialog"]').should('be.visible');
      cy.contains('Edit User').should('be.visible');
      cy.get('[data-cy="user-role-select"]').click();
      cy.get('mat-option').contains('VIEWER').click();
      cy.get('[data-cy="user-save-btn"]').click();
      cy.get('[data-cy="user-dialog"]').should('not.exist');
      cy.contains('tr', 'Cypress Test User').should('contain.text', 'VIEWER');

      // DELETE
      cy.contains('tr', 'Cypress Test User').find('[data-cy="delete-user-btn"]').click();
      cy.get('[data-cy="delete-confirm-dialog"]').should('be.visible');
      cy.get('[data-cy="delete-confirm-btn"]').click();
      cy.get('[data-cy="delete-confirm-dialog"]').should('not.exist');
      cy.get('[data-cy="users-table"]').should('not.contain.text', 'Cypress Test User');
    });

    it('should open edit user dialog with prefilled data', () => {
      cy.get('[data-cy="edit-user-btn"]').first().click();
      cy.get('[data-cy="user-dialog"]').should('be.visible');
      cy.contains('Edit User').should('be.visible');
      cy.get('[data-cy="user-name-input"]').invoke('val').should('not.be.empty');
      cy.get('[data-cy="user-role-select"]').should('be.visible');
      cy.get('[data-cy="user-cancel-btn"]').click();
    });

    it('should show validation error for empty fields', () => {
      cy.get('[data-cy="add-user-btn"]').click();
      cy.get('[data-cy="user-save-btn"]').click();
      cy.get('[data-cy="user-form-error"]').should('be.visible');
      cy.get('[data-cy="user-form-error"]').should('contain.text', 'required');
    });
  });

  // ====== TEAM MANAGEMENT ======
  describe('Team Management', () => {
    beforeEach(() => {
      cy.loginAsAdmin();
      cy.contains('a', 'Teams').click();
      cy.url().should('include', '/admin/teams');
    });

    it('should display team management page with stats', () => {
      cy.contains('h1', 'Team Management').should('be.visible');
      cy.contains('Total Teams').should('be.visible');
      cy.contains('Total Members').should('be.visible');
      cy.contains('Unassigned Users').should('be.visible');
    });

    it('should show Add Team button', () => {
      cy.get('[data-cy="add-team-btn"]').should('be.visible');
      cy.get('[data-cy="add-team-btn"]').should('contain.text', 'Add Team');
    });

    it('should display team cards with edit/delete buttons', () => {
      cy.get('[data-cy="team-card"]').should('have.length.at.least', 1);
      cy.get('[data-cy="edit-team-btn"]').should('have.length.at.least', 1);
      cy.get('[data-cy="delete-team-btn"]').should('have.length.at.least', 1);
    });

    it('should open add team dialog', () => {
      cy.get('[data-cy="add-team-btn"]').click();
      cy.get('[data-cy="team-dialog"]').should('be.visible');
      cy.contains('Add New Team').should('be.visible');
      cy.get('[data-cy="team-name-input"]').should('be.visible');
      cy.get('[data-cy="team-desc-input"]').should('be.visible');
      cy.get('[data-cy="team-members-select"]').should('be.visible');
    });

    it('should close add team dialog on cancel', () => {
      cy.get('[data-cy="add-team-btn"]').click();
      cy.get('[data-cy="team-dialog"]').should('be.visible');
      cy.get('[data-cy="team-cancel-btn"]').click();
      cy.get('[data-cy="team-dialog"]').should('not.exist');
    });

    it('should create a new team', () => {
      cy.get('[data-cy="add-team-btn"]').click();
      cy.get('[data-cy="team-name-input"]').type('Cypress Test Team');
      cy.get('[data-cy="team-desc-input"]').type('Created by Cypress E2E test');
      // Save without members first
      cy.get('[data-cy="team-save-btn"]').click();
      cy.get('[data-cy="team-dialog"]').should('not.exist');
      // Verify new team appears
      cy.contains('Cypress Test Team').should('be.visible');
    });

    it('should edit a team', () => {
      cy.contains('mat-card', 'Cypress Test Team').find('[data-cy="edit-team-btn"]').click();
      cy.get('[data-cy="team-dialog"]').should('be.visible');
      cy.contains('Edit Team').should('be.visible');
      // Change name
      cy.get('[data-cy="team-name-input"]').clear().type('Cypress Updated Team');
      cy.get('[data-cy="team-save-btn"]').click();
      cy.get('[data-cy="team-dialog"]').should('not.exist');
      cy.contains('Cypress Updated Team').should('be.visible');
    });

    it('should delete a team', () => {
      cy.contains('mat-card', 'Cypress Updated Team').find('[data-cy="delete-team-btn"]').click();
      cy.get('[data-cy="team-delete-confirm"]').should('be.visible');
      cy.contains('Are you sure you want to delete').should('be.visible');
      cy.get('[data-cy="team-delete-confirm-btn"]').click();
      cy.get('[data-cy="team-delete-confirm"]').should('not.exist');
      cy.contains('Cypress Updated Team').should('not.exist');
    });

    it('should show validation error for empty name', () => {
      cy.get('[data-cy="add-team-btn"]').click();
      cy.get('[data-cy="team-save-btn"]').click();
      cy.get('[data-cy="team-form-error"]').should('be.visible');
      cy.get('[data-cy="team-form-error"]').should('contain.text', 'required');
    });
  });

  // ====== WORKFLOW MANAGEMENT ======
  describe('Workflow Management', () => {
    beforeEach(() => {
      cy.loginAsAdmin();
      cy.contains('a', 'Workflows').click();
      cy.url().should('include', '/admin/workflows');
    });

    it('should display workflow management page with stats', () => {
      cy.contains('h1', 'Workflow Management').should('be.visible');
      cy.contains('Total Workflows').should('be.visible');
      cy.contains('Active').should('be.visible');
      cy.contains('Inactive').should('be.visible');
    });

    it('should display workflows in table format', () => {
      cy.get('[data-cy="workflows-table"]').should('be.visible');
      cy.contains('th', 'Name').should('be.visible');
      cy.contains('th', 'Case Type').should('be.visible');
      cy.contains('th', 'Version').should('be.visible');
      cy.contains('th', 'Status').should('be.visible');
      cy.contains('th', 'Updated').should('be.visible');
      cy.contains('th', 'Actions').should('be.visible');
    });

    it('should show paginator', () => {
      cy.get('[data-cy="workflows-paginator"]').should('be.visible');
    });

    it('should display workflow data in table rows', () => {
      // At least one workflow should exist from seed data
      cy.get('[data-cy="workflows-table"] tbody tr').should('have.length.at.least', 1);
    });

    it('should show Open Designer button', () => {
      cy.contains('Open Designer').should('be.visible');
    });

    it('should have edit link for each workflow', () => {
      cy.get('[data-cy="workflows-table"] tbody tr').first().within(() => {
        cy.get('a[mattooltip="Open in Designer"]').should('exist');
      });
    });
  });
});
