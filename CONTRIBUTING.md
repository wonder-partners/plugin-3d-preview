# @wonder/plugin-3d-preview

## 0. Prerequisites

- Node.js 18.16.0 or higher
- Yarn 1.22.19 or higher

> [!NOTE]  
> You can install Yarn using npm by running `npm install -g yarn`.

> [!IMPORTANT]  
> Make sure you run all commands in an admin shell.

## 1. Create a Nocobase development instance

### 1.1. Create a new Nocobase project

Use the Nocobase CLI:

```bash
yarn create nocobase-app <project_name> -d sqlite
```

This will create a new Nocobase project in the `<project_name>` directory with SQLite as the database.

Change directory to the project:

```bash
cd <project_name>
```

### 1.2. Install dependencies

Install the sqlite driver explicitly in the workspace:

```bash
yarn add sqlite3 -W
```

```bash
yarn nocobase install
```

This will install all dependencies and prepare the Nocobase instance.

### 1.3. Run the Nocobase instance

```bash
yarn dev
```

> [!NOTE]  
> The Nocobase instance will be accessible at `http://localhost:13000`. The default username and password are `admin@nocobase.com` and `admin123`.

## 2. Add the plugin to your development environment

### 2.1. Create the folder

```bash
mkdir -p packages/plugins/@wonder
cd packages/plugins/@wonder
```

### 2.2. Clone the repository

```bash
git clone https://github.com/wonder/plugin-hello.git
```

### 2.3. Upgrade Nocobase

Move to the root directory of the Nocobase project:

```bash
cd <project_name>
```

> [!IMPORTANT]  
> Make sure your Nocobase instance is running before installing and upgrading!

```bash
yarn install
```

```bash
yarn nocobase upgrade
```

Restart the Nocobase instance:

```bash
yarn dev
```

Your plugin should now be available to enable in the Nocobase UI under `/admin/pm/list/local/`.

## 3. Build the plugin

> [!NOTE]  
> If you cloned the Nocobase source code, execute `yarn build` in the root directory for a full build.

In the root directory of the plugin, run:

```bash
yarn build @<scope>/<plugin_name> --tar
```

The tarball will be created at `storage/tar/@<scope>/<plugin_name>.tar.gz`.

For more information, see [Nocobase documentation](https://www.nocobase.com/en/blog/simplify-the-process-of-adding-and-updating-plugins) on how to build and install plugins.

## License

By contributing to this project, you agree that your contributions will be licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](./LICENSE).
