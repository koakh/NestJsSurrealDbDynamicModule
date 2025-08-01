DEFINE NAMESPACE test;
DEFINE DATABASE test;

-- Define the user table with proper permissions
-- https://surrealdb.com/docs/surrealql/statements/define/table#defining-permissions
-- https://claude.ai/chat/4abf8c3e-c943-4b03-9ec2-359feb43fd82
DEFINE TABLE user SCHEMAFULL PERMISSIONS 
  -- this will be used to check permission when we are signin and select all users
  FOR SELECT WHERE id = $auth.id OR $auth.admin = true,  
  FOR CREATE FULL, 
  FOR UPDATE, DELETE WHERE id = $auth.id OR $auth.admin = true;

-- Define fields
DEFINE FIELD username ON user TYPE string ASSERT $value != NONE;
DEFINE FIELD password ON user TYPE string ASSERT $value != NONE;
-- flexible
DEFINE FIELD settings ON user TYPE object DEFAULT {};
DEFINE FIELD settings.marketing ON user TYPE bool DEFAULT false;
DEFINE FIELD tags ON user TYPE option<array<string>> DEFAULT [];

-- Define unique index
DEFINE INDEX idx_username ON user COLUMNS username UNIQUE;

-- Define access method for authentication
-- https://surrealdb.com/docs/sdk/javascript/core/handling-authentication#defining-access-in-your-application
-- define access method/function
DEFINE ACCESS account ON DATABASE TYPE RECORD
  SIGNUP ( CREATE user SET username = $username, password = crypto::argon2::generate($password), settings.marketing = $marketing, tags = $tags )
  SIGNIN ( SELECT * FROM user WHERE username = $username AND crypto::argon2::compare(password, $password) )
  DURATION FOR TOKEN 15m, FOR SESSION 12h;

-- info for user
INFO FOR TABLE user;

-- Test function
DEFINE FUNCTION fn::greet($name: string) {
    RETURN "Hello, " + $name + "!";
};
-- RETURN fn::greet("Tobie");

-- graphql to generate audit fields
-- REMOVE TABLE IF EXISTS restaurant;
-- DEFINE TABLE restaurant SCHEMALESS PERMISSIONS NONE;
-- DEFINE FIELD createdAt ON restaurant VALUE time::now() READONLY;
-- DEFINE FIELD updatedAt ON restaurant VALUE time::now();
-- 
-- REMOVE TABLE IF EXISTS recipe;
-- DEFINE TABLE recipe SCHEMALESS PERMISSIONS NONE;
-- DEFINE FIELD createdAt ON recipe VALUE time::now() READONLY;
-- DEFINE FIELD updatedAt ON recipe VALUE time::now();