interface PaginatedResponse<Values = unknown> {
  values: Values[]
  /**
   * Current number of objects on the existing page. The default value is 10 with 100 being the maximum allowed value. Individual APIs may enforce different values.
   */
  pagelen: number
  /**
   * Page number of the current results. This is an optional element that is not provided in all responses.
   */
  page: number
  /**
   * Total number of objects in the response. This is an optional element that is not provided in all responses, as it can be expensive to compute.
   */
  size: number
  /**
   * Link to the next page if it exists. The last page of a collection does not have this value. Use this link to navigate the result set and refrain from constructing your own URLs.
   */
  next?: string
  /**
   * Link to previous page if it exists. A collections first page does not have this value. This is an optional element that is not provided in all responses. Some result sets strictly support forward navigation and never provide previous links. Clients must anticipate that backwards navigation is not always available. Use this link to navigate the result set and refrain from constructing your own URLs.
   */
  previous?: string
}

type Links<LinkTypes extends string = 'self' | 'html'> = Record<LinkTypes, { name?: string, href: string }>

interface MarkupObject {
  raw: string
  markup: string
  html: string
}

export interface IAccount {
  links: Links<'avatar'>
  created_on?: string
  display_name: string
  uuid: string
}

export interface IUser {
  links: Links<'self' | 'html' | 'repositories'>

  account_id: string
  account_status?: string
  has_2fa_enabled?: boolean
  nickname: string
  is_staff?: boolean
}

export interface IWorkspace {
  links: Links<'avatar' | 'html' | 'members' | 'owners' | 'projects' | 'repositories' | 'snippets' | 'self'>

  uuid: string
  name: string
  slug: string

  is_private: boolean
  is_privacy_enforced: boolean

  created_on: string
  updated_on: string
}

export interface IWorkspaceMemberShip {
  links: Links<'self' | 'workspace'>

  permission: string
  workspace: IWorkspace
  user: IAccount
}

export interface ITeam {
  links: Links<'self' | 'html' | 'members' | 'projects' | 'repositories'>
}

export interface ICodeSearchResult {
  content_matches: unknown[]
  path_matches: unknown[]

  file: ICommitFile
}

export interface IProject {
  links: Links<'html' | 'avatar'>

  uuid: string
  key: string
  name: string
  description: string

  owner: IAccount | ITeam
  is_private: boolean

  created_on: string
  updated_on: string
  has_publicly_visible_repos: boolean
}

export interface IRepository {
  links: Links<'self' | 'html' | 'avatar' | 'pullrequests' | 'commits' | 'forks' | 'watchers' | 'downloads' | 'clone' | 'hooks'>

  uuid: string
  name: string
  full_name: string
  description: string

  owner: IAccount
  is_private: boolean
  scm: string

  created_on: string
  updated_on: string

  size: number
  language: string
  has_issues: boolean
  has_wiki: boolean
  fork_policy: string

  parent?: IRepository
  project: IProject
  mainbranch: IBranch
}

// #region Commits

export interface IAuthor {
  raw: string
  user: IAccount
}
export interface IBaseCommit {
  hash: string
  date: string
  author: IAuthor
  message: string
  summary: {
    raw: string
    markup: string
    html: string
  }
  parents?: IBaseCommit[]
}
export interface IParticipant {
  user: IAccount
  role: string
  approved: boolean
  state: string
  participated_on: string
}
export interface ICommit {
  repository: IRepository
  participants: IParticipant[]
}
export interface ICommitFile {
  path: string
  commit: IBaseCommit & ICommit
  attributes: string
  escaped_path: string
}

export type IRef = IBaseCommit & ICommit

export type IBranch = IRef & {
  merge_strategies: string[]
  default_merge_strategy: string
}

// #endregion

// #region Pipelines

interface IPipelineTarget {
  type: string
}
interface IPipelineTrigger {
  type: string
}
interface IPipelineState {
  type: string
}
interface IPipelineConfigurationSource {
  source: string
  uri: string
}
export interface IPipeline {
  links: Links<'self' | 'steps'>

  uuid: string
  build_number: number
  repository: IRepository
  creator: IAccount

  created_on: string
  completed_on?: string
  build_seconds_used: number

  target: IPipelineTarget
  trigger: IPipelineTrigger
  state: IPipelineState
  variables: IPipelineVariable[]
  configuration_sources: IPipelineConfigurationSource[]
}

export interface IPipelineVariable {
  key: string
  value: string
  secured: boolean
  uuid: string
}

/**
 * Commit statuses provide a way to tag commits with meta data, like automated build results.
 */
export interface ICommitStatus {
  links: Links<'self' | 'commit'>
  uuid: string
  key: string
  refname: string
  url: string
  state: string
  name: string
  description: string
  created_on: string
  updated_on: string
}

// #endregion

// #region Pull Requests

/**
 * Returned when dealing with repo-specific reviewers
 */
export type IDefaultReviewer = IAccount & IUser
/**
 * Used by effective-default-reviewers
 */
export interface IDefaultReviewerAndType {
  type: string
  reviewer_type: string
  user: IDefaultReviewer
}

export interface IPullRequestEndpoint {
  repository: IRepository
  branch: IBranch
  commit: IBaseCommit
}
export interface IPullRequest {
  links: Links<'self' | 'html' | 'commits' | 'approve' | 'diff' | 'diffstat' | 'comments' | 'activity' | 'merge' | 'decline'>
  id: number
  title: string
  rendered: {
    raw: MarkupObject
    markup: MarkupObject
    html: MarkupObject
  }
  summary: MarkupObject
  state: string
  author: IAccount
  source: IPullRequestEndpoint
  destination: IPullRequestEndpoint
  merge_commit: {
    hash: string
  }
  comment_count: number
  task_count: number
  close_source_branch: boolean
  closed_by: IAccount
  reason: string
  created_on: string
  updated_on: string
  reviewers: IAccount[]
  participants: IParticipant[]
}

// #endregion

// #region API Responses

export interface Responses {
  /* Outdenting (un-denting? reverse-denting? de-denting?) the HTTP method makes it more readable */
  /* eslint-disable @typescript-eslint/indent */
  'GET /repositories/{workspace}': PaginatedResponse<IRepository>
  'GET /repositories/{workspace}/{repo_slug}': IRepository
  'GET /repositories/{workspace}/{repo_slug}/commit/{commit}/statuses': PaginatedResponse<ICommitStatus>

  'GET /repositories/{workspace}/{repo_slug}/default-reviewers': PaginatedResponse<IAccount>
  'PUT /repositories/{workspace}/{repo_slug}/default-reviewers/{target_username}': IAccount
  'GET /repositories/{workspace}/{repo_slug}/effective-default-reviewers': PaginatedResponse<IDefaultReviewerAndType>

  'GET /repositories/{workspace}/{repo_slug}/pipelines': PaginatedResponse<IPipeline>
  'GET /repositories/{workspace}/{repo_slug}/pipelines/{pipeline_uuid}': IPipeline
  'GET /repositories/{workspace}/{repo_slug}/pipelines_config/variables': PaginatedResponse<IPipelineVariable>
 'POST /repositories/{workspace}/{repo_slug}/pipelines_config/variables': IPipelineVariable
  'PUT /repositories/{workspace}/{repo_slug}/pipelines_config/variables/{variable_uuid}': IPipelineVariable

 'POST /repositories/{workspace}/{repo_slug}/pullrequests': IPullRequest

  'GET /user': IUser & IAccount
  'GET /user/permissions/workspaces': PaginatedResponse<IWorkspaceMemberShip>

  'GET /workspaces/{workspace}': IWorkspace
  'GET /workspaces/{workspace}/projects/{project_key}': IProject
  'GET /workspaces/{workspace}/search/code': PaginatedResponse<ICodeSearchResult>
  /* eslint-enable @typescript-eslint/indent */
}

// #endregion
