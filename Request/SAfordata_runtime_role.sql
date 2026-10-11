-- DBA provisioning, run after schema migration as the application schema owner
-- with CREATE ROLE privilege. Grant this role to a separate API login.
SET DEFINE OFF
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK
-- Database role to be granted to a separately provisioned API login by the DBA.
-- No password, CONNECT ANY, CREATE ANY, owner login or PUBLIC grants are packaged.
CREATE ROLE KKU_APP_RUNTIME;
-- Only grant necessary DML. No DDL, TRUNCATE, stock UPDATE or audit DELETE.
GRANT SELECT ON kku_app_lock TO KKU_APP_RUNTIME;
GRANT SELECT,INSERT,UPDATE ON booking TO KKU_APP_RUNTIME;
GRANT SELECT,INSERT ON booking_equipment TO KKU_APP_RUNTIME;
GRANT UPDATE(issued_qty,returned_qty) ON booking_equipment TO KKU_APP_RUNTIME;
GRANT SELECT ON equipment TO KKU_APP_RUNTIME;
GRANT SELECT ON users TO KKU_APP_RUNTIME;
GRANT SELECT ON room TO KKU_APP_RUNTIME;
GRANT SELECT ON room_assignment TO KKU_APP_RUNTIME;
GRANT SELECT ON room_closure TO KKU_APP_RUNTIME;
GRANT SELECT ON holiday TO KKU_APP_RUNTIME;
GRANT SELECT ON staff TO KKU_APP_RUNTIME;
GRANT SELECT ON penalty TO KKU_APP_RUNTIME;
GRANT SELECT,INSERT ON booking_log TO KKU_APP_RUNTIME;
GRANT SELECT,INSERT ON booking_violation TO KKU_APP_RUNTIME;
GRANT SELECT ON stock_movement TO KKU_APP_RUNTIME;
GRANT SELECT,INSERT,UPDATE ON notification TO KKU_APP_RUNTIME;
GRANT SELECT,INSERT,UPDATE ON command_attempt TO KKU_APP_RUNTIME;
-- The Oracle role is a minimum booking integration role, not a complete admin API.
-- The deployed application continues to use PostgreSQL, whose auth/admin flow is implemented.
