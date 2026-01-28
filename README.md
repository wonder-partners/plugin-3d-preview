# @wonder/plugin-hello

## How to contribute

To start contributing to this plugin, follow these steps:

### 0. Prerequisites

- Node.js 18.16.0 or higher
- Yarn 1.22.19 or higher

> **Note**: You can install Yarn using npm by running `npm install -g yarn`

### 1. Create a Nocobase development instance

#### 1.1. Create a new Nocobase project

Use the Nocobase CLI:

```bash
yarn create nocobase-app <project_name> -d sqlite
```

This will create a new Nocobase project in the `<project_name>` directory with SQLite as the database.

> **Note**: SQLite is only recommended for development and testing purposes.

Change directory to the project:

```bash
cd <project_name>
```

#### 1.2. Install dependencies

```bash
yarn install
```

```bash
yarn nocobase install
```

This will install all dependencies and prepare the Nocobase instance.

#### 1.3. Run the Nocobase instance

```bash
yarn dev
```

> **Note**: The Nocobase instance will be accessible at `http://localhost:13000`. The default username and password are `admin@nocobase.com` and `admin123`.

### 2. Add the plugin to your development environment

#### 2.1. Create the folder

```bash
mkdir -p packages/plugins/@wonder
cd packages/plugins/@wonder
```

#### 2.2. Clone the repository

```bash
git clone https://github.com/wonder/plugin-hello.git
```

#### 2.3. Upgrade Nocobase

> **Important**: Make sure your Nocobase instance is running before upgrading!

```bash
yarn nocobase install
# or
yarn nocobase upgrade
```

Your plugin should now be available in the Nocobase UI under `/admin/pm/list/local/`.

### 3. Make changes to the plugin

Make your changes, when you need to test them, run:

```bash
yarn nocobase upgrade
```

### 4. Build the plugin

In the root directory of the plugin, run:

```bash
yarn build @<scope>/<plugin_name> --tar
```

The tarball will be created at `storage/tar/@<scope>/<plugin_name>.tar.gz`.

For more information, see [Nocobase documentation](https://www.nocobase.com/en/blog/simplify-the-process-of-adding-and-updating-plugins) on how to build and install plugins.
