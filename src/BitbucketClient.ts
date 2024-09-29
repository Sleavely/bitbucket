import FormData from 'form-data'
import got, { type ExtendOptions, type Got } from 'got'
import { posix } from 'path'
import { type IAccount, type ICommitStatus, type IDefaultReviewerAndType, type IPipeline, type IPullRequest, type ICodeSearchResult, type IProject, type IRepository, type IWorkspace, type Responses, type IPipelineVariable, type IDefaultReviewer } from './types/api'

interface BitbucketClientOptions {
  auth: {
    username: string
    password: string
  }
}

/**
 * A workspace ID (slug) or its UUID surrounded by curly-braces, for example: {workspace UUID}
 */
type WorkspaceIdentifier = string

/**
 * A username or a UUID surrounded by curly-braces, for example: {account UUID}.
 */
type UserIdentifier = string

export class BitbucketClient {
  client: Got

  constructor (opts: BitbucketClientOptions) {
    if (!opts.auth) {
      throw new Error('Missing auth params')
    }

    this.client = got.extend({
      prefixUrl: 'https://api.bitbucket.org/2.0/',
      headers: {
        Accept: 'application/json',
      },
      responseType: 'json',
      ...opts.auth,
    })
  }

  extend (
    gotOpts: ExtendOptions,
  ): void {
    this.client = this.client.extend(gotOpts)
  }

  // #region User

  async getCurrentUser (): Promise<IAccount> {
    return await this
      .client('user')
      .json<Responses['GET /user']>()
  }

  // #endregion

  // #region Workspaces

  async listWorkspaces (): Promise<Array<IWorkspace & { permission: string }>> {
    const { values } = await this
      .client('user/permissions/workspaces')
      .json<Responses['GET /user/permissions/workspaces']>()
    return values.map(({ permission, workspace }) => {
      return { ...workspace, permission }
    })
  }

  async getWorkspace (
    workspace: WorkspaceIdentifier,
  ): Promise<IWorkspace> {
    return await this
      .client(`workspaces/${workspace}}`)
      .json<Responses['GET /workspaces/{workspace}']>()
  }

  // #endregion

  // #region Projects

  async getProject (
    workspace: WorkspaceIdentifier,
    projectKey: string,
  ): Promise<IProject> {
    return await this
      .client(`workspaces/${workspace}/projects/${projectKey}`)
      .json<Responses['GET /workspaces/{workspace}/projects/{project_key}']>()
  }

  // #endregion

  // #region Repositories

  async getRepositoriesByProject (
    workspace: WorkspaceIdentifier,
    projectKey: string,
    requestPage?: number,
  ): Promise<IRepository[]> {
    const res = await this
      .client(`repositories/${workspace}?q=project.key="${projectKey}"${requestPage ? `&page=${requestPage}` : ''}`)
      .json<Responses['GET /repositories/{workspace}']>()

    // automatically deal with pagination to get complete list
    const { values, next, page: currentPage } = res
    if (next) return [...values, ...await this.getRepositoriesByProject(workspace, projectKey, currentPage + 1)]
    return values
  }

  async getRepository (
    workspace: WorkspaceIdentifier,
    repoSlug: string,
  ): Promise<IRepository> {
    return await this
      .client(`repositories/${workspace}/${repoSlug}`)
      .json<Responses['GET /repositories/{workspace}/{repo_slug}']>()
  }

  /**
   * @deprecated This only returns repo-level defaults, not inherited ones. Use getEffectiveDefaultReviewers instead.
   * @see getEffectiveDefaultReviewers
   */
  async getDefaultReviewers (
    workspace: WorkspaceIdentifier,
    repoSlug: string,
  ): Promise<IAccount[]> {
    const { values } = await this
      .client(`repositories/${workspace}/${repoSlug}/default-reviewers`)
      .json<Responses['GET /repositories/{workspace}/{repo_slug}/default-reviewers']>()
    return values
  }

  /**
   * Adds the specified user to the repository's list of default reviewers. This method is idempotent. Adding a user a second time has no effect.
   */
  async addDefaultReviewer (
    workspace: WorkspaceIdentifier,
    repoSlug: string,
    targetUser: UserIdentifier,
  ): Promise<IAccount> {
    return await this
      .client
      .put(`repositories/${workspace}/${repoSlug}/default-reviewers/${targetUser}`)
      .json<Responses['PUT /repositories/{workspace}/{repo_slug}/default-reviewers/{target_username}']>()
  }

  async removeDefaultReviewer (
    workspace: WorkspaceIdentifier,
    repoSlug: string,
    targetUser: UserIdentifier,
  ): Promise<void> {
    await this
      .client
      .delete(`repositories/${workspace}/${repoSlug}/default-reviewers/${targetUser}`)
  }

  /**
   * Includes both default reviewers defined at the repository level as well as those inherited from its project.
   */
  async getEffectiveDefaultReviewers (
    workspace: WorkspaceIdentifier,
    repoSlug: string,
  ): Promise<Array<IDefaultReviewer & { reviewer_type: IDefaultReviewerAndType['reviewer_type'] }>> {
    const { values } = await this
      .client(`repositories/${workspace}/${repoSlug}/effective-default-reviewers`)
      .json<Responses['GET /repositories/{workspace}/{repo_slug}/effective-default-reviewers']>()
    // eslint-disable-next-line @typescript-eslint/naming-convention
    return values.map(({ user, reviewer_type }) => ({ ...user, reviewer_type }))
  }

  // #endregion

  // #region Pipelines

  /**
   * Gets 10 most recent pipelines that were created
   */
  async getPipelines (
    workspace: WorkspaceIdentifier,
    repoSlug: string,
  ): Promise<IPipeline[]> {
    const { values } = await this
      .client(`repositories/${workspace}/${repoSlug}/pipelines/?sort=-created_on`)
      .json<Responses['GET /repositories/{workspace}/{repo_slug}/pipelines']>()
    return values
  }

  async getPipeline (
    workspace: WorkspaceIdentifier,
    repoSlug: string,
    pipelineUuid: string,
  ): Promise<IPipeline> {
    return await this
      .client(`repositories/${workspace}/${repoSlug}/pipelines/${pipelineUuid}`)
      .json<Responses['GET /repositories/{workspace}/{repo_slug}/pipelines/{pipeline_uuid}']>()
  }

  async getCommitStatuses (
    workspace: WorkspaceIdentifier,
    repoSlug: string,
    commit: string,
  ): Promise<ICommitStatus[]> {
    const { values } = await this
      .client(`repositories/${workspace}/${repoSlug}/commit/${commit}/statuses`)
      .json<Responses['GET /repositories/{workspace}/{repo_slug}/commit/{commit}/statuses']>()
    return values
  }

  /**
 * Returns repository level variables
 */
  async getRepoVariables (
    workspace: WorkspaceIdentifier,
    repoSlug: string,
  ): Promise<IPipelineVariable[]> {
    const { values } = await this
      .client(`repositories/${workspace}/${repoSlug}/pipelines_config/variables`)
      .json<Responses['GET /repositories/{workspace}/{repo_slug}/pipelines_config/variables']>()
    return values
  }

  /**
   * Regardless of whether it exists or not
   */
  async setRepoVariable (
    workspace: string,
    repoSlug: string,
    varName: string,
    varValue: string,
  ): Promise<IPipelineVariable> {
    const repoVars = await this
      .getRepoVariables(workspace, repoSlug)
    const existingVariable = repoVars
      .find(({ key }) => key === varName)

    if (!existingVariable) {
      return await this.createRepoVariable(workspace, repoSlug, varName, varValue)
    } else {
      return await this.updateRepoVariable(workspace, repoSlug, existingVariable.uuid, varName, varValue)
    }
  }

  async createRepoVariable (
    workspace: WorkspaceIdentifier,
    repoSlug: string,
    varName: string,
    varValue: string,
  ): Promise<IPipelineVariable> {
    return await this
      .client
      .post(
      `repositories/${workspace}/${repoSlug}/pipelines_config/variables`, {
        json: {
          type: 'pipeline_variable',
          key: varName,
          value: varValue,
          secured: true,
        },
      })
      .json<Responses['POST /repositories/{workspace}/{repo_slug}/pipelines_config/variables']>()
  }

  async updateRepoVariable (
    workspace: WorkspaceIdentifier,
    repoSlug: string,
    varUuid: string,
    varName: string,
    varValue: string,
  ): Promise<IPipelineVariable> {
    return await this
      .client
      .put(
      `repositories/${workspace}/${repoSlug}/pipelines_config/variables/${varUuid}`, {
        json: {
          type: 'pipeline_variable',
          uuid: varUuid,
          key: varName,
          value: varValue,
          secured: true,
        },
      })
      .json<Responses['PUT /repositories/{workspace}/{repo_slug}/pipelines_config/variables/{variable_uuid}']>()
  }

  async deleteRepoVariable (
    workspace: string,
    repoSlug: string,
    varName: string,
  ): Promise<unknown> {
    const repoVars = await this
      .getRepoVariables(workspace, repoSlug)
    const variableProps = repoVars
      .find(({ key }) => key === varName)
    if (!variableProps) return null

    return await this.client.delete(`repositories/${workspace}/${repoSlug}/pipelines_config/variables/${variableProps.uuid}`)
  }

  // #endregion

  // #region Pull Requests

  async createPullRequest (
    workspace: WorkspaceIdentifier,
    repoSlug: string,
    title: string,
    sourceBranch: string,
    destinationBranch?: string,
  ): Promise<IPullRequest> {
    const currentUser = await this.getCurrentUser()
    const defaultReviewers = (await this.getEffectiveDefaultReviewers(workspace, repoSlug))
      // PR author cant be a reviewer
      .filter((reviewer) => currentUser.uuid !== reviewer.uuid)

    const destination = destinationBranch ? { branch: { name: destinationBranch } } : undefined

    return await this
      .client
      .post(
        `repositories/${workspace}/${repoSlug}/pullrequests`, {
          json: {
            title,
            source: { branch: { name: sourceBranch } },
            destination,
            reviewers: defaultReviewers,
            close_source_branch: true,
          },
        })
      .json<Responses['POST /repositories/{workspace}/{repo_slug}/pullrequests']>()
  }

  // #endregion

  // #region Files

  async getFile (
    workspace: WorkspaceIdentifier,
    repoSlug: string,
    commitOrRef: string,
    filePath: string,
  ): Promise<string | null> {
    const absolutePath = posix.resolve('/', filePath)
    return await this
      .client.extend({ responseType: 'text' })(`repositories/${workspace}/${repoSlug}/src/${commitOrRef}${absolutePath}`)
      .then(res => res.body)
      .catch((err) => {
        if (err.response && err.response.statusCode === 404) return null
        throw err
      })
  }

  /**
   * @param workspace
   * @param repoSlug
   * @param filePath A file path in the repository
   * @param contents
   * @param message The commit message
   * @param author Should be in format of `Joakim Hedlund <contact@joakimhedlund.com>`. Defaults to the current user.
   * @param branch The name of the branch that the new commit should be created on. When omitted, the commit will be created on top of the main branch
   * @returns Full commit hash
   */
  async commitFile (
    workspace: WorkspaceIdentifier,
    repoSlug: string,
    filePath: string,
    contents: string,
    message = 'Posted a file via API',
    author?: string,
    branch?: string,
  ): Promise<string> {
    const form = new FormData()
    form.append(filePath, contents)
    if (message) form.append('message', message)
    if (author) form.append('author', author)
    if (branch) form.append('branch', branch)

    const res = await this
      .client
      .post(`repositories/${workspace}/${repoSlug}/src`, {
        body: form,
      })
    // Should never actually be unknown, but the type for IncomingMessage doesnt know that
    const commitHash = res.headers?.location?.split('/')?.at(-1) ?? '<unknown>'
    return commitHash
  }

  /**
   * @param workspace
   * @param repoSlug
   * @param filePath A file path in the repository
   * @param message The commit message
   * @param author Should be in format of `Joakim Hedlund <contact@joakimhedlund.com>`. Defaults to the current user.
   * @param branch The name of the branch that the new commit should be created on. When omitted, the commit will be created on top of the main branch
   * @returns Full commit hash
   */
  async removeFile (
    workspace: WorkspaceIdentifier,
    repoSlug: string,
    filePath: string,
    message = 'Removed a file via API',
    author?: string,
    branch?: string,
  ): Promise<string> {
    const form = new FormData()
    form.append('files', filePath)
    if (message) form.append('message', message)
    if (author) form.append('author', author)
    if (branch) form.append('branch', branch)

    const res = await this
      .client
      .post(`repositories/${workspace}/${repoSlug}/src`, {
        body: form,
      })
    // Should never actually be unknown, but the type for IncomingMessage doesnt know that
    const commitHash = res.headers?.location?.split('/')?.at(-1) ?? '<unknown>'
    return commitHash
  }

  async codeSearch (
    workspace: WorkspaceIdentifier,
    query: string,
    requestPage?: number,
  ): Promise<ICodeSearchResult[]> {
    const queryparams = new URLSearchParams({
      search_query: query,
      fields: '+values.file.commit.repository',
    })
    if (requestPage) queryparams.append('page', requestPage.toString())

    const res = await this
      .client(`workspaces/${workspace}/search/code?${queryparams.toString()}`)
      .json<Responses['GET /workspaces/{workspace}/search/code']>()

    const { values, next, page: currentPage } = res
    if (next) return [...values, ...await this.codeSearch(workspace, query, currentPage + 1)]
    return values
  }

  // #endregion
}
