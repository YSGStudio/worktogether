alter policy projects_select on public.projects using (
  public.is_teacher_of_project(id) or public.is_project_member(id) or leader_id = auth.uid()
);
